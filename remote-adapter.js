(function initDeosRemoteAdapter(global) {
  const supabaseApi = global.DeosSupabase || {};
  const createRemoteError = typeof supabaseApi.createRemoteError === "function"
    ? supabaseApi.createRemoteError
    : (code, message, details) => ({ code, message, details: details || null });
  const ALLOWED_TEST_PAYLOAD_KEYS = new Set(["scenario", "device", "note", "timestamp", "status", "conflictToken", "client"]);
  const RESERVED_DEOS_KEYS = new Set([
    "actions",
    "managers",
    "projects",
    "decisions",
    "priorities",
    "activity",
    "journal",
    "documents",
    "agenda",
    "folders",
    "performance",
    "meetingPreparations",
    "links",
    "performance_imports",
    "deos_actions",
    "deos_managers",
    "deos_projects",
    "deos_decisions",
    "deos_priorities",
    "deos_activity",
    "deos_journal",
    "deos_documents",
    "deos_agenda",
    "deos_folders",
    "deos_performance",
    "deos_meetingPreparations",
    "deos_links",
    "deos_performance_imports"
  ]);

  function clonePlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return JSON.parse(JSON.stringify(value));
  }

  function validatePayloadShape(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw createRemoteError("INVALID_TEST_PAYLOAD", "Le payload distant doit rester un objet de test simple.");
    }
    for (const key of Object.keys(payload)) {
      if (RESERVED_DEOS_KEYS.has(key) || !ALLOWED_TEST_PAYLOAD_KEYS.has(key)) {
        throw createRemoteError("TEST_ONLY_GUARD", `La cle ${key} n'est pas autorisee dans le mode distant V5.21C.`);
      }
    }
  }

  function normalizeLabel(label) {
    const value = String(label || "").trim();
    if (!/^test\b/i.test(value)) {
      throw createRemoteError("TEST_ONLY_LABEL_REQUIRED", "Seuls des enregistrements de test explicites sont autorises dans cette version.");
    }
    return value;
  }

  function normalizeRecord(record, expectedWorkspaceId, ownerId) {
    const payload = clonePlainObject(record.payload || {});
    validatePayloadShape(payload);
    return {
      workspace_id: expectedWorkspaceId,
      owner_id: ownerId,
      label: normalizeLabel(record.label),
      payload,
      version: Number.isFinite(Number(record.version)) ? Number(record.version) : 1,
      deleted_at: record.deleted_at || null
    };
  }

  class SupabaseRemoteAdapter {
    constructor(authService, options = {}) {
      this.authService = authService;
      this.debug = Boolean(options.debug);
    }

    getContext(workspaceId) {
      if (!this.authService || !this.authService.getClient || !this.authService.getClient()) {
        throw createRemoteError("REMOTE_CLIENT_UNAVAILABLE", "Client distant indisponible.");
      }
      if (!this.authService.isAuthenticated || !this.authService.isAuthenticated()) {
        throw createRemoteError("AUTH_REQUIRED", "Authentification requise pour le mode distant.");
      }
      const user = this.authService.getCurrentUser();
      const context = this.authService.getWorkspaceContext ? this.authService.getWorkspaceContext() : {};
      const activeWorkspaceId = context.workspace && context.workspace.id ? String(context.workspace.id) : "";
      const role = String(context.role || "").toLowerCase();
      if (!activeWorkspaceId) {
        throw createRemoteError("WORKSPACE_REQUIRED", "Aucun workspace distant n'est actif pour cet utilisateur.");
      }
      if (workspaceId && String(workspaceId) !== activeWorkspaceId) {
        throw createRemoteError("WORKSPACE_OVERRIDE_FORBIDDEN", "Le frontend ne peut pas viser un autre workspace dans cette version.");
      }
      return {
        client: this.authService.getClient(),
        workspaceId: activeWorkspaceId,
        userId: user && user.id ? String(user.id) : "",
        role
      };
    }

    assertWritableRole(role) {
      if (["owner", "admin", "contributor"].includes(String(role || "").toLowerCase())) return;
      throw createRemoteError("FORBIDDEN_ROLE", "Ce role distant ne peut pas ecrire dans les enregistrements de test.");
    }

    async listTestRecords(workspaceId) {
      const context = this.getContext(workspaceId);
      const response = await context.client
        .from("deos_test_records")
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .eq("workspace_id", context.workspaceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (response.error) throw createRemoteError("REMOTE_LIST_FAILED", response.error.message || "Lecture distante impossible.");
      return Array.isArray(response.data) ? response.data : [];
    }

    async getTestRecord(id) {
      const context = this.getContext();
      const response = await context.client
        .from("deos_test_records")
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .eq("id", id)
        .eq("workspace_id", context.workspaceId)
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_GET_FAILED", response.error.message || "Lecture du record impossible.");
      return response.data || null;
    }

    async createTestRecord(data) {
      const context = this.getContext(data && data.workspaceId);
      this.assertWritableRole(context.role);
      const record = normalizeRecord(data || {}, context.workspaceId, context.userId);
      const response = await context.client
        .from("deos_test_records")
        .insert(record)
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .single();
      if (response.error) throw createRemoteError("REMOTE_CREATE_FAILED", response.error.message || "Creation distante impossible.");
      return response.data;
    }

    async updateTestRecord(id, patch, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) {
        throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour une mise a jour distante.");
      }
      const payload = patch && Object.prototype.hasOwnProperty.call(patch, "payload")
        ? clonePlainObject(patch.payload)
        : undefined;
      if (payload !== undefined) validatePayloadShape(payload);
      const label = patch && Object.prototype.hasOwnProperty.call(patch, "label") ? normalizeLabel(patch.label) : undefined;
      const updatePayload = {
        version: version + 1,
        updated_at: new Date().toISOString()
      };
      if (payload !== undefined) updatePayload.payload = payload;
      if (label !== undefined) updatePayload.label = label;
      const response = await context.client
        .from("deos_test_records")
        .update(updatePayload)
        .eq("id", id)
        .eq("workspace_id", context.workspaceId)
        .eq("version", version)
        .is("deleted_at", null)
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_UPDATE_FAILED", response.error.message || "Mise a jour distante impossible.");
      if (response.data) return response.data;
      const current = await this.getTestRecord(id);
      if (current && Number(current.version) !== version) {
        throw createRemoteError("CONFLICT", "Le record distant a change depuis votre derniere lecture.", {
          currentVersion: Number(current.version || 0)
        });
      }
      throw createRemoteError("REMOTE_RECORD_NOT_FOUND", "Record distant introuvable ou deja supprime.");
    }

    async softDeleteTestRecord(id, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const current = await this.getTestRecord(id);
      if (!current) throw createRemoteError("REMOTE_RECORD_NOT_FOUND", "Record distant introuvable.");
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version !== Number(current.version)) {
        throw createRemoteError("CONFLICT", "Le record distant a change avant suppression logique.", {
          currentVersion: Number(current.version || 0)
        });
      }
      const response = await context.client
        .from("deos_test_records")
        .update({
          deleted_at: new Date().toISOString(),
          version: version + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("workspace_id", context.workspaceId)
        .eq("version", version)
        .is("deleted_at", null)
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_DELETE_FAILED", response.error.message || "Suppression logique impossible.");
      if (response.data) return response.data;
      throw createRemoteError("CONFLICT", "Le record distant a ete modifie avant suppression logique.");
    }
  }

  global.DeosSupabaseRemote = {
    SupabaseRemoteAdapter
  };
})(window);