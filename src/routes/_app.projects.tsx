import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  FolderKanban,
  Plus,
  Settings2,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  ArrowLeftRight,
  RotateCcw,
  UserCheck,
  User,
  Shield,
  Building2,
  Palette,
  ShoppingBag,
  PhoneCall,
  Code2,
  ExternalLink,
  Sparkles,
  Layers,
  Check,
  CheckCheck,
  X,
  FileText,
  DollarSign,
  Briefcase,
  Phone,
  Mail,
  RefreshCw,
  Bell,
  Paperclip,
  UploadCloud,
  Download,
  MessageSquare,
  Send,
  AtSign,
  Trash2,
  Reply,
  CornerUpLeft,
  ChevronDown,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { useCrm } from "@/lib/crm-store";
import { isAdminEmail } from "@/lib/crm-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Department,
  Project,
  ProjectComment,
  fetchAllDepartments,
  saveAllDepartments,
  assignDepartmentManagerSync,
  demoteManagerToAgentSync,
  fetchAllProjects,
  saveAllProjects,
  createNewProject,
  claimProject,
  transferProject,
  markProjectDone,
  requestProjectRedo,
  cancelProjectWithReason,
  deleteProject,
  deleteProjectComment,
  markProjectSeen,
  markAllProjectsSeen,
  addProjectComment,
  isUserAdminOrManager,
  getUserAssignedDepartment,
  getUserAssignedDepartments,
  isUserMentionedInComment,
  isUserMentionedInProject,
  isEcommerceDepartment,
  updateUserRoleAndTitleSync,
} from "@/lib/project-management-store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/projects")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      view: (search.view as string) || undefined,
      projectId: (search.projectId as string) || (search.id as string) || (search.project as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Project Management — Teals CRM" },
      {
        name: "description",
        content: "Multi-department inter-connected project workflow, task claiming, and revision tracking.",
      },
    ],
  }),
  component: ProjectsPage,
});

const NOTIF_STORAGE_KEY = "teals_read_notifs";

function getStoredReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(NOTIF_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const { user } = useCrm();
  const userEmail = (user?.email || "").toLowerCase().trim();
  const userName = user?.name || userEmail.split("@")[0] || "Agent";
  const isSuperAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(userEmail)));

  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("teals_crm_projects");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registeredAgents, setRegisteredAgents] = useState<Array<{ name: string; email: string; role?: string }>>([]);
  const pendingCommentsRef = React.useRef<Map<string, ProjectComment[]>>(new Map());
  const deletedCommentIdsRef = React.useRef<Set<string>>(new Set());

  // View Mode: 'list' (Row-wise Asana style - default) | 'board' (Kanban 3 columns) | 'notifications' (Project Activity & Notifications History)
  const [viewMode, setViewMode] = useState<"list" | "board" | "notifications">(() => {
    if (searchParams?.view === "notifications") return "notifications";
    if (searchParams?.view === "board") return "board";
    return "list";
  });

  useEffect(() => {
    if (searchParams?.view === "notifications") {
      setViewMode("notifications");
    } else if (searchParams?.view === "board") {
      setViewMode("board");
    } else {
      setViewMode("list");
    }
  }, [searchParams?.view]);

  const handleSetViewMode = (mode: "list" | "board" | "notifications") => {
    setViewMode(mode);
    navigate({
      search: (prev: any) => ({
        ...prev,
        view: mode === "list" ? undefined : mode,
      }),
      replace: true,
    });
  };

  // Collapsible Section States for Row-wise view
  const [activeSectionOpen, setActiveSectionOpen] = useState(true);
  const [completedSectionOpen, setCompletedSectionOpen] = useState(true);
  const [cancelledSectionOpen, setCancelledSectionOpen] = useState(true);

  // Filters & State
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [mentionsFilter, setMentionsFilter] = useState<"all" | "mentions">("all");

  // Notifications View State
  const [notifCategoryTab, setNotifCategoryTab] = useState<"all" | "revisions" | "transfers" | "mentions" | "completed">("all");
  const [notifStatusFilter, setNotifStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [notifSearchQuery, setNotifSearchQuery] = useState("");
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(() => getStoredReadIds());

  // Modals & Navigation
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [transferModalProject, setTransferModalProject] = useState<Project | null>(null);
  const [redoModalProject, setRedoModalProject] = useState<Project | null>(null);
  const [cancelModalProject, setCancelModalProject] = useState<Project | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [doneModalProject, setDoneModalProject] = useState<Project | null>(null);
  const [doneModalNotes, setDoneModalNotes] = useState("");
  const [accessRestrictedModalProject, setAccessRestrictedModalProject] = useState<Project | null>(null);

  // Dedicated Project Detail View (Full Page view for clicked project)
  const [activeDetailPageProject, setActiveDetailPageProject] = useState<Project | null>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const pid = urlParams.get("projectId") || urlParams.get("id") || urlParams.get("project");
      if (pid && projects.length > 0) {
        return projects.find((p) => p.id === pid) || null;
      }
    }
    if (searchParams?.projectId && projects.length > 0) {
      return projects.find((p) => p.id === searchParams.projectId) || null;
    }
    return null;
  });

  // Sync activeDetailPageProject with URL search param projectId
  useEffect(() => {
    const targetId = searchParams?.projectId;
    if (targetId) {
      const found = projects.find((p) => p.id === targetId);
      if (found) {
        setActiveDetailPageProject(found);
      }
    } else if (!targetId && activeDetailPageProject) {
      setActiveDetailPageProject(null);
    }
  }, [searchParams?.projectId, projects]);

  const activeProjectRevisions = useMemo(() => {
    if (!activeDetailPageProject || !Array.isArray(activeDetailPageProject.revision_history)) return [];
    const seen = new Set<string>();
    const list: ProjectRevision[] = [];
    activeDetailPageProject.revision_history.forEach((r) => {
      if (!r) return;
      const cleanIssues = (r.issues_and_changes || "").trim().toLowerCase();
      if (!cleanIssues) return;
      if (!seen.has(cleanIssues)) {
        seen.add(cleanIssues);
        list.push(r);
      }
    });
    return list;
  }, [activeDetailPageProject?.revision_history]);

  // Comment State & Replies in Detail View
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToModalComment, setReplyingToModalComment] = useState<ProjectComment | null>(null);

  // Forms & Uploads
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingExtraFile, setUploadingExtraFile] = useState(false);
  const [submittingProject, setSubmittingProject] = useState(false);
  const isCreatingProjectRef = React.useRef(false);

  const [newProject, setNewProject] = useState<{
    title: string;
    target_department_id: string;
    subcategory: string;
    priority: "urgent" | "high" | "medium" | "normal";
    client_company: string;
    client_email: string;
    client_phone: string;
    budget_or_value: string;
    description: string;
    attachments_links: string;
    attached_files?: Array<{ name: string; url: string; size?: number; type?: string }>;
    direct_assignee_email?: string;
  }>({
    title: "",
    target_department_id: "production-house",
    subcategory: "Graphic Design",
    priority: "medium",
    client_company: "",
    client_email: "",
    client_phone: "",
    budget_or_value: "",
    description: "",
    attachments_links: "",
    attached_files: [],
    direct_assignee_email: "",
  });

  const [newDeptForm, setNewDeptForm] = useState<{
    name: string;
    description: string;
    icon: string;
    color: string;
    subcategoriesStr: string;
  }>({
    name: "",
    description: "",
    icon: "Briefcase",
    color: "violet",
    subcategoriesStr: "Graphic Design, Web Development",
  });

  const [transferForm, setTransferForm] = useState<{
    targetAgentEmail: string;
    targetDepartmentId: string;
    reason: string;
  }>({
    targetAgentEmail: "",
    targetDepartmentId: "",
    reason: "",
  });

  const [redoForm, setRedoForm] = useState<{
    issuesAndChanges: string;
  }>({
    issuesAndChanges: "",
  });

  // ── LOAD INITIAL DATA ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [deptsData, projsData] = await Promise.all([
        fetchAllDepartments(),
        fetchAllProjects(),
      ]);
      setDepartments(deptsData);

      const cleanUserEmail = (userEmail || "").toLowerCase().trim();
      if (cleanUserEmail && projsData.length > 0) {
        const hasUnseen = projsData.some((p) => {
          const seen = (p.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
          return !seen.includes(cleanUserEmail);
        });
        if (hasUnseen) {
          markAllProjectsSeen(cleanUserEmail).catch(() => {});
        }
      }

      // projsData is the authoritative list from the server
      setProjects((prevProjects) => {
        const deletedIds = deletedCommentIdsRef.current;
        const merged = projsData.map((serverP) => {
          let seenEmails = (serverP.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
          if (cleanUserEmail && !seenEmails.includes(cleanUserEmail)) {
            seenEmails = [...seenEmails, cleanUserEmail];
          }

          const localP = prevProjects.find((p) => p.id === serverP.id);
          const commentMap = new Map<string, ProjectComment>();

          // 1. Add server comments (excluding deleted ones)
          (serverP.comments || []).forEach((c: ProjectComment) => {
            if (c && c.id && !deletedIds.has(c.id)) {
              commentMap.set(c.id, c);
            }
          });

          // 2. Preserve any local comments recently added in local state
          if (localP && Array.isArray(localP.comments)) {
            localP.comments.forEach((c: ProjectComment) => {
              if (c && c.id && !deletedIds.has(c.id) && !commentMap.has(c.id)) {
                const age = Date.now() - new Date(c.created_at).getTime();
                if (isNaN(age) || age < 180000) {
                  commentMap.set(c.id, c);
                }
              }
            });
          }

          // 3. Add any pending comments from pendingCommentsRef
          const pending = pendingCommentsRef.current.get(serverP.id) || [];
          const stillPending: ProjectComment[] = [];
          pending.forEach((c) => {
            if (c && c.id && !deletedIds.has(c.id)) {
              if (!commentMap.has(c.id)) {
                commentMap.set(c.id, c);
                stillPending.push(c);
              }
            }
          });
          pendingCommentsRef.current.set(serverP.id, stillPending);

          const combinedComments = Array.from(commentMap.values());
          combinedComments.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          // Deduplicate revisions
          const rawRevs = Array.isArray(serverP.revision_history) ? serverP.revision_history : [];
          const seenRevs = new Set<string>();
          const dedupedRevs: ProjectRevision[] = [];
          rawRevs.forEach((r) => {
            if (!r) return;
            const cleanIssues = (r.issues_and_changes || "").trim().toLowerCase();
            if (!cleanIssues) return;
            if (!seenRevs.has(cleanIssues)) {
              seenRevs.add(cleanIssues);
              dedupedRevs.push(r);
            }
          });

          return { ...serverP, comments: combinedComments, revision_history: dedupedRevs, seen_by_emails: seenEmails };
        });

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("teals_crm_projects", JSON.stringify(merged));
          } catch {}
        }

        return merged;
      });

      // Load registered agents & admins from CRM
      const knownList: Array<{
        name: string;
        email: string;
        role?: string;
        departmentId?: string;
        departmentName?: string;
        designation?: string;
      }> = [
        { name: "Garry Amelia", email: "garryamelia6265@gmail.com", role: "admin" },
        { name: "Jennifer Cisternino", email: "jennifer.cisternino2027@gmail.com", role: "admin" },
        { name: "Talha Zafar", email: "tzafar04@gmail.com", role: "admin" },
        { name: "Annus Raees", email: "annusraees@gmail.com", role: "admin" },
      ];
      const agentMap = new Map<
        string,
        {
          name: string;
          email: string;
          role?: string;
          departmentId?: string;
          departmentName?: string;
          designation?: string;
        }
      >();
      knownList.forEach((k) => agentMap.set(k.email.toLowerCase().trim(), k));

      // Fetch profiles from Supabase
      try {
        const { data: profiles } = await supabase.from("profiles").select("full_name, email, role, avatar_url");
        if (profiles) {
          profiles.forEach((p) => {
            if (p.email) {
              const em = p.email.toLowerCase().trim();
              const isMainAdmin = isAdminEmail(em);
              let parsedRole = isMainAdmin ? "admin" : (p.role || "working_agent");
              let deptId: string | undefined = undefined;
              let deptName: string | undefined = undefined;
              let designation: string | undefined = undefined;

              if (p.avatar_url) {
                try {
                  const meta = JSON.parse(p.avatar_url);
                  if (meta.role && !isMainAdmin) parsedRole = meta.role;
                  if (meta.department_id) deptId = meta.department_id;
                  if (meta.department_name) deptName = meta.department_name;
                  if (meta.designation) designation = meta.designation;
                } catch {}
              }

              // Check if in department table
              const matchingDept = deptsData.find(
                (d) =>
                  (d.manager_email && d.manager_email.toLowerCase().trim() === em) ||
                  (Array.isArray(d.member_emails) && d.member_emails.some((m) => m.toLowerCase().trim() === em))
              );

              if (matchingDept) {
                deptId = matchingDept.id;
                deptName = matchingDept.name;
                if (matchingDept.manager_email && matchingDept.manager_email.toLowerCase().trim() === em) {
                  parsedRole = "manager";
                }
              }

              const existing = agentMap.get(em);
              agentMap.set(em, {
                name: p.full_name || existing?.name || em.split("@")[0],
                email: em,
                role: parsedRole,
                departmentId: deptId || existing?.departmentId,
                departmentName: deptName || existing?.departmentName,
                designation: designation || existing?.designation,
              });
            }
          });
        }
      } catch {}

      if (userEmail) {
        const existing = agentMap.get(userEmail);
        agentMap.set(userEmail, {
          name: userName,
          email: userEmail,
          role: isSuperAdmin ? "admin" : existing?.role || "working_agent",
          departmentId: existing?.departmentId,
          departmentName: existing?.departmentName,
          designation: existing?.designation,
        });
      }

      setRegisteredAgents(Array.from(agentMap.values()));
    } catch (err) {
      console.error("Failed to load project management data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail, userName, isSuperAdmin]);

  useEffect(() => {
    loadData();

    // Setup Realtime WebSocket & Cross-tab sync
    let bc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("teals-crm-projects-sync");
        bc.onmessage = (event: any) => {
          if (event?.data?.event === "project_comment_deleted" && event?.data?.payload?.commentId) {
            deletedCommentIdsRef.current.add(event.data.payload.commentId);
          }
          loadData();
        };
      }
    } catch {}

    const projSubId = Math.random().toString(36).substring(2, 9);
    const channel = supabase.channel(`projects-live-${projSubId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "crm_project_created" }, (msg: any) => {
        const p = msg?.payload?.project;
        if (p) {
          setProjects((prev) => [p, ...prev.filter((item) => item.id !== p.id)]);
        } else {
          loadData();
        }
      })
      .on("broadcast", { event: "crm_project_claimed" }, (msg: any) => {
        const p = msg?.payload?.project;
        if (p) {
          setProjects((prev) => prev.map((item) => (item.id === p.id ? p : item)));
          setActiveDetailPageProject((prev) => (prev && prev.id === p.id ? p : prev));
        } else {
          loadData();
        }
      })
      .on("broadcast", { event: "crm_project_transferred" }, (msg: any) => {
        const p = msg?.payload?.project;
        if (p) {
          setProjects((prev) => prev.map((item) => (item.id === p.id ? p : item)));
          setActiveDetailPageProject((prev) => (prev && prev.id === p.id ? p : prev));
        } else {
          loadData();
        }
      })
      .on("broadcast", { event: "crm_project_completed" }, (msg: any) => {
        const p = msg?.payload?.project;
        if (p) {
          setProjects((prev) => prev.map((item) => (item.id === p.id ? p : item)));
          setActiveDetailPageProject((prev) => (prev && prev.id === p.id ? p : prev));
        } else {
          loadData();
        }
      })
      .on("broadcast", { event: "crm_project_redo_requested" }, (msg: any) => {
        const p = msg?.payload?.project;
        if (p) {
          setProjects((prev) => prev.map((item) => (item.id === p.id ? p : item)));
          setActiveDetailPageProject((prev) => (prev && prev.id === p.id ? p : prev));
        } else {
          loadData();
        }
      })
      .on("broadcast", { event: "crm_project_cancelled" }, (msg: any) => {
        const p = msg?.payload?.project;
        if (p) {
          setProjects((prev) => prev.map((item) => (item.id === p.id ? p : item)));
          setActiveDetailPageProject((prev) => (prev && prev.id === p.id ? p : prev));
        } else {
          loadData();
        }
      })
      .on("broadcast", { event: "crm_project_comment_added" }, (eventMsg: any) => {
        const p: Project | undefined = eventMsg?.payload?.project;
        if (p) {
          const pending = pendingCommentsRef.current.get(p.id) || [];
          const existingIds = new Set((p.comments || []).map((c) => c.id));
          const stillPending = pending.filter((c) => !existingIds.has(c.id));
          pendingCommentsRef.current.set(p.id, stillPending);

          const combined = [...(p.comments || []), ...stillPending];
          combined.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const finalProj = { ...p, comments: combined };

          setProjects((prev) => prev.map((item) => (item.id === finalProj.id ? finalProj : item)));
          setActiveDetailPageProject((prev) => (prev && prev.id === finalProj.id ? finalProj : prev));
          if (typeof window !== "undefined") {
            try {
              const cached = localStorage.getItem("teals_crm_projects");
              if (cached) {
                const list = JSON.parse(cached);
                if (Array.isArray(list)) {
                  const updated = list.map((item: any) => (item.id === finalProj.id ? finalProj : item));
                  localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
                }
              }
            } catch {}
          }
        } else {
          loadData();
        }

        if (p && Array.isArray(p.comments) && p.comments.length > 0) {
          const lastCmt = p.comments[p.comments.length - 1];
          if (lastCmt && (lastCmt.author_email || "").toLowerCase().trim() !== userEmail) {
            const isTaggingMe = isUserMentionedInComment(lastCmt, userEmail, userName);
            if (isTaggingMe) {
              toast.info(`🔔 ${lastCmt.author_name} mentioned you in "${p.title}": "${lastCmt.content.slice(0, 70)}"`, {
                duration: 9000,
              });
            }
          }
        }
      })
      .on("broadcast", { event: "crm_project_deleted" }, (msg: any) => {
        const pid = msg?.payload?.projectId;
        if (pid) {
          setProjects((prev) => prev.filter((item) => item.id !== pid));
          setActiveDetailPageProject((prev) => (prev && prev.id === pid ? null : prev));
        } else {
          loadData();
        }
      })
      .on("broadcast", { event: "crm_project_comment_deleted" }, (msg: any) => {
        const p = msg?.payload?.project;
        const cmtId = msg?.payload?.commentId;
        if (cmtId) {
          deletedCommentIdsRef.current.add(cmtId);
        }
        if (p) {
          const filteredComments = (p.comments || []).filter(
            (c: ProjectComment) => !deletedCommentIdsRef.current.has(c.id)
          );
          const sanitizedProj = { ...p, comments: filteredComments };
          setProjects((prev) => prev.map((item) => (item.id === p.id ? sanitizedProj : item)));
          setActiveDetailPageProject((prev) => (prev && prev.id === p.id ? sanitizedProj : prev));
        } else {
          loadData();
        }
      })
      .on("broadcast", { event: "crm_departments_updated" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, () => loadData())
      .subscribe();

    // Background polling interval for guaranteed live multi-user sync
    const interval = setInterval(() => {
      loadData();
    }, 4000);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [loadData, userEmail, userName]);

  // Global Escape key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCreateModalOpen(false);
        setDeptModalOpen(false);
        setTransferModalProject(null);
        setRedoModalProject(null);
        setCancelModalProject(null);
        setAccessRestrictedModalProject(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keep detail page synced with latest data
  useEffect(() => {
    if (activeDetailPageProject) {
      const latest = projects.find((p) => p.id === activeDetailPageProject.id);
      if (latest && JSON.stringify(latest) !== JSON.stringify(activeDetailPageProject)) {
        setActiveDetailPageProject(latest);
      }
    }
  }, [projects, activeDetailPageProject]);

  // Current user's department context
  const userAssignedDepts = useMemo(() => {
    return getUserAssignedDepartments(userEmail, departments);
  }, [userEmail, departments]);

  const userDept = userAssignedDepts[0] || null;
  const isAssignedToAnyDept = isSuperAdmin || userAssignedDepts.length > 0;

  const isManagerOfAnyDept = useMemo(() => {
    return departments.some(
      (d) => d.manager_email && d.manager_email.toLowerCase().trim() === userEmail
    );
  }, [userEmail, departments]);

  const canManageDepartments = isSuperAdmin || isManagerOfAnyDept;

  // Helper to determine if user is manager of a specific project
  const isManagerOfProject = useCallback(
    (p: Project) => {
      if (!userEmail) return false;
      if (isSuperAdmin) return true;
      const clean = userEmail.toLowerCase().trim();

      // Check target department manager
      const targetDept = departments.find((d) => d.id === p.target_department_id);
      if (targetDept?.manager_email && targetDept.manager_email.toLowerCase().trim() === clean) {
        return true;
      }

      // Check creator department manager
      const creatorDept = departments.find(
        (d) =>
          d.id === p.created_by_department ||
          d.name === p.created_by_department ||
          (d.manager_email && d.manager_email.toLowerCase().trim() === (p.created_by_email || "").toLowerCase().trim())
      );
      if (creatorDept?.manager_email && creatorDept.manager_email.toLowerCase().trim() === clean) {
        return true;
      }

      return false;
    },
    [userEmail, isSuperAdmin, departments]
  );

  // Permission: Can the user open/inspect this project?
  // Regular agents CANNOT open Cancelled or Deleted projects! Only Managers and Admins can!
  const canUserOpenProject = useCallback(
    (p: Project) => {
      if (p.status !== "cancelled") return true;
      return isSuperAdmin || isManagerOfProject(p);
    },
    [isSuperAdmin, isManagerOfProject]
  );

  // Helper to determine if an email is manager of any department
  const getManagerDepartment = useCallback(
    (email?: string | null) => {
      if (!email) return null;
      const clean = email.toLowerCase().trim();
      return departments.find((d) => d.manager_email && d.manager_email.toLowerCase().trim() === clean) || null;
    },
    [departments]
  );

  // Only Working Agents (Strictly excludes all Admins from department working agent allocation)
  const onlyWorkingAgents = useMemo(() => {
    return registeredAgents.filter((a) => {
      const isAdm = a.role === "admin" || isAdminEmail(a.email.toLowerCase().trim());
      return !isAdm;
    });
  }, [registeredAgents]);

  // Helper: Filter agents for a specific department
  const getAvailableAgentsForDept = useCallback(
    (deptId: string) => {
      return onlyWorkingAgents.filter((a) => {
        const clean = a.email.toLowerCase().trim();
        const isAssignedToThisDept = departments.some(
          (d) =>
            d.id === deptId &&
            (d.member_emails.includes(clean) ||
              (d.manager_email && d.manager_email.toLowerCase().trim() === clean))
        );
        if (isAssignedToThisDept) return true;

        const isAssignedToOtherDept = departments.some(
          (d) =>
            d.id !== deptId &&
            (d.member_emails.includes(clean) ||
              (d.manager_email && d.manager_email.toLowerCase().trim() === clean))
        );

        return !isAssignedToOtherDept;
      });
    },
    [onlyWorkingAgents, departments]
  );

  // Helper: Get structured assignee groups (Manager, Working Agents, Super Admins) for any department
  const getDeptAssigneeGroups = useCallback(
    (targetDeptId?: string) => {
      const dept = departments.find((d) => d.id === targetDeptId);
      const isEcommerce = isEcommerceDepartment(targetDeptId, dept?.name);
      const deptManagerEmail = (dept?.manager_email || "").toLowerCase().trim();

      // 1. Department Manager
      const manager = deptManagerEmail
        ? registeredAgents.find((a) => a.email.toLowerCase().trim() === deptManagerEmail) || {
            name: deptManagerEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            email: deptManagerEmail,
            role: "manager",
            departmentId: targetDeptId,
            departmentName: dept?.name,
            designation: "Department Manager",
          }
        : null;

      // 2. Department Working Agents (EXCLUDED for E-commerce Department as per policy - only Manager or direct department pool)
      const workingAgents = isEcommerce
        ? []
        : registeredAgents.filter((a) => {
            const em = a.email.toLowerCase().trim();
            const isAdm = a.role === "admin" || isAdminEmail(em);
            if (isAdm) return false;
            if (deptManagerEmail && em === deptManagerEmail) return false;

            const isExplicitMember = Array.isArray(dept?.member_emails) && dept.member_emails.some((m) => m.toLowerCase().trim() === em);
            const isMatchingDept = a.departmentId === targetDeptId;

            if (isExplicitMember || isMatchingDept) return true;

            const isAssignedElsewhere = departments.some(
              (d) =>
                d.id !== targetDeptId &&
                ((Array.isArray(d.member_emails) && d.member_emails.some((m) => m.toLowerCase().trim() === em)) ||
                  (d.manager_email && d.manager_email.toLowerCase().trim() === em))
            );

            if (!isAssignedElsewhere && targetDeptId === "production-house") return true;

            return false;
          });

      // 3. Super Admins
      const admins = registeredAgents.filter((a) => a.role === "admin" || isAdminEmail(a.email.toLowerCase().trim()));

      return { manager, workingAgents, admins, isEcommerce, deptName: dept?.name };
    },
    [departments, registeredAgents]
  );

  // Auto-set selected department on initial load for working agents
  useEffect(() => {
    if (!isSuperAdmin) {
      if (userAssignedDepts.length > 0) {
        const isValidDept = userAssignedDepts.some((d) => d.id === selectedDeptId);
        if (!isValidDept && selectedDeptId !== "created_by_me" && selectedDeptId !== "mentions") {
          setSelectedDeptId(userAssignedDepts[0].id);
        }
      }
    }
  }, [isSuperAdmin, userAssignedDepts, selectedDeptId]);

  // Department Icon Component
  const getDeptIcon = (iconName?: string) => {
    switch (iconName) {
      case "Palette": return Palette;
      case "ShoppingBag": return ShoppingBag;
      case "PhoneCall": return PhoneCall;
      case "Code2": return Code2;
      case "Building2": return Building2;
      default: return Briefcase;
    }
  };

  // ── FILTER PROJECTS ────────────────────────────────────────────────────────
  const visibleProjects = useMemo(() => {
    return projects.filter((p) => {
      const isCreator = p.created_by_email.toLowerCase().trim() === userEmail;
      const isClaimedByMe = (p.claimed_by_email || "").toLowerCase().trim() === userEmail;
      const isMentioned = isUserMentionedInProject(p, userEmail, userName);
      const hasComments = Array.isArray(p.comments) && p.comments.length > 0;

      // 1. Department / Special Tab Filter
      if (selectedDeptId === "mentions") {
        const isMentioned = isUserMentionedInProject(p, userEmail, userName);
        if (isMentioned) return true;
        const hasMentions = (p.comments || []).some((c) => (Array.isArray(c.mentions) && c.mentions.length > 0) || /@\w+/.test(c.content || ""));
        if (isSuperAdmin && hasMentions) return true;
        if (isManagerOfProject(p) && hasMentions) return true;
        return false;
      } else if (selectedDeptId === "created_by_me") {
        if (!isCreator) return false;
      } else if (!isSuperAdmin) {
        const myDeptIds = userAssignedDepts.map((d) => d.id);
        const isTargetInMyDepts = myDeptIds.includes(p.target_department_id);

        if (!isTargetInMyDepts && !isCreator && !isClaimedByMe && !isMentioned) {
          return false;
        }

        if (selectedDeptId !== "all" && p.target_department_id !== selectedDeptId && !isMentioned) {
          return false;
        }
      } else {
        if (selectedDeptId !== "all" && p.target_department_id !== selectedDeptId) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== "all") {
        if (statusFilter === "active_inprogress" && (p.status === "done" || p.status === "cancelled")) return false;
        if (statusFilter === "done" && p.status !== "done") return false;
        if (statusFilter === "cancelled" && p.status !== "cancelled") return false;
      }

      // 3. Priority Filter
      if (priorityFilter !== "all" && p.priority !== priorityFilter) {
        return false;
      }

      // 4. Subcategory Filter
      if (selectedSubcategory !== "all" && p.subcategory !== selectedSubcategory) {
        return false;
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const t = (p.title || "").toLowerCase();
        const d = (p.description || "").toLowerCase();
        const cn = (p.client_name || "").toLowerCase();
        const cp = (p.client_company || "").toLowerCase();
        const sub = (p.subcategory || "").toLowerCase();
        const cl = (p.claimed_by_name || "").toLowerCase();
        const cmtMatch = (p.comments || []).some(
          (c) =>
            (c.content || "").toLowerCase().includes(q) ||
            (c.author_name || "").toLowerCase().includes(q) ||
            (c.author_email || "").toLowerCase().includes(q)
        );
        if (!t.includes(q) && !d.includes(q) && !cn.includes(q) && !cp.includes(q) && !sub.includes(q) && !cl.includes(q) && !cmtMatch) {
          return false;
        }
      }

      return true;
    });
  }, [projects, isSuperAdmin, userAssignedDepts, userEmail, userName, selectedDeptId, priorityFilter, statusFilter, selectedSubcategory, searchQuery]);

  // Section 1: Active & In-Progress (Top)
  const activeProjects = useMemo(() => {
    return visibleProjects
      .filter((p) => p.status !== "done" && p.status !== "cancelled")
      .sort((a, b) => {
        // Urgent first, then High, then recent update
        const priorityScore: Record<string, number> = { urgent: 4, high: 3, medium: 2, normal: 1 };
        const scoreDiff = (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      });
  }, [visibleProjects]);

  // Section 2: Completed & Delivered
  const doneProjects = useMemo(() => {
    return visibleProjects
      .filter((p) => p.status === "done")
      .sort((a, b) => new Date(b.completed_at || b.updated_at).getTime() - new Date(a.completed_at || a.updated_at).getTime());
  }, [visibleProjects]);

  // Section 3: Cancelled / Removed (Bottom)
  const cancelledProjects = useMemo(() => {
    return visibleProjects
      .filter((p) => p.status === "cancelled")
      .sort((a, b) => new Date(b.cancelled_at || b.updated_at).getTime() - new Date(a.cancelled_at || a.updated_at).getTime());
  }, [visibleProjects]);

  // Filter Visibility Logic: When priority, status, or search filters are applied, only show non-empty matching sections
  const isAnyFilterActive = statusFilter !== "all" || priorityFilter !== "all" || Boolean(searchQuery.trim());
  const shouldShowActiveSection = (statusFilter === "all" || statusFilter === "active_inprogress") && (!isAnyFilterActive || activeProjects.length > 0);
  const shouldShowDoneSection = (statusFilter === "all" || statusFilter === "done") && (!isAnyFilterActive || doneProjects.length > 0);
  const shouldShowCancelledSection = (statusFilter === "all" || statusFilter === "cancelled") && (!isAnyFilterActive || cancelledProjects.length > 0);
  const hasAnyMatchingProjects = activeProjects.length > 0 || doneProjects.length > 0 || cancelledProjects.length > 0;
  const visibleColsCount = (shouldShowActiveSection ? 1 : 0) + (shouldShowDoneSection ? 1 : 0) + (shouldShowCancelledSection ? 1 : 0);

  // Projects with direct @mentions
  const myMentionedProjects = useMemo(() => {
    return projects.filter((p) => {
      const isMentioned = isUserMentionedInProject(p, userEmail, userName);
      if (isMentioned) return true;
      const hasMentions = (p.comments || []).some((c) => (Array.isArray(c.mentions) && c.mentions.length > 0) || /@\w+/.test(c.content || ""));
      if (isSuperAdmin && hasMentions) return true;
      if (isManagerOfProject(p) && hasMentions) return true;
      return false;
    });
  }, [projects, userEmail, userName, isSuperAdmin, isManagerOfProject]);

  // Dedicated Mentions & Discussion Inquiries List (Strictly @mentions only, visible to tagged user, admin, & manager)
  const allInquiriesAndMentions = useMemo(() => {
    const list: Array<{
      comment: ProjectComment;
      project: Project;
      isMentioned: boolean;
      createdTime: number;
    }> = [];

    const cleanUser = (userEmail || "").toLowerCase().trim();

    for (const p of projects) {
      if (Array.isArray(p.comments)) {
        for (const c of p.comments) {
          if (!c) continue;
          // Check if this comment has any @mention at all
          const hasMention = (Array.isArray(c.mentions) && c.mentions.length > 0) || /@\w+/.test(c.content || "");
          if (!hasMention) continue;

          const authorEmail = (c.author_email || "").toLowerCase().trim();
          const isAuthor = cleanUser && authorEmail === cleanUser;
          const isMentioned = isUserMentionedInComment(c, userEmail, userName);
          const isDeptManager = isManagerOfProject(p);

          // 1. Tagged user -> SEES IT
          // 2. Super Admin -> SEES IT (if not author)
          // 3. Dept Manager -> SEES IT (if not author)
          // 4. Author who created the comment -> DOES NOT SEE IT in their own incoming mentions inbox
          if (isMentioned) {
            list.push({
              comment: c,
              project: p,
              isMentioned: true,
              createdTime: new Date(c.created_at).getTime(),
            });
          } else if (isSuperAdmin && !isAuthor) {
            list.push({
              comment: c,
              project: p,
              isMentioned: false,
              createdTime: new Date(c.created_at).getTime(),
            });
          } else if (isDeptManager && !isAuthor) {
            list.push({
              comment: c,
              project: p,
              isMentioned: false,
              createdTime: new Date(c.created_at).getTime(),
            });
          }
        }
      }
    }

    list.sort((a, b) => b.createdTime - a.createdTime);
    return list;
  }, [projects, userEmail, userName, isSuperAdmin, isManagerOfProject]);

  const filteredMentionsList = useMemo(() => {
    let result = allInquiriesAndMentions;
    if (mentionsFilter === "mentions") {
      result = result.filter((item) => item.isMentioned);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          (item.comment.content || "").toLowerCase().includes(q) ||
          (item.comment.author_name || "").toLowerCase().includes(q) ||
          (item.project.title || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [allInquiriesAndMentions, mentionsFilter, searchQuery]);

  // ── UNIFIED PROJECT NOTIFICATIONS GENERATOR ─────────────────────────────────
  const allProjectNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      category: "revision" | "transfer" | "mention" | "comment" | "project_created" | "project_claimed" | "project_done";
      title: string;
      body: string;
      detail?: string;
      authorName?: string;
      authorEmail?: string;
      authorRole?: string;
      projectName: string;
      project: Project;
      targetDepartmentName?: string;
      rawTime: string;
      formattedTime: string;
      formattedDate: string;
      read: boolean;
      priority: string;
    }> = [];

    const readSet = readNotifIds;

    projects.forEach((p) => {
      const isCreator = (p.created_by_email || "").toLowerCase().trim() === userEmail;
      const isClaimedByMe = (p.claimed_by_email || "").toLowerCase().trim() === userEmail;
      const isMentionedInProj = isUserMentionedInProject(p, userEmail, userName);
      const isDeptMember = userAssignedDepts.some((d) => d.id === p.target_department_id);
      const isManagerOfThis = isManagerOfProject(p);

      if (!isSuperAdmin && !isDeptMember && !isCreator && !isClaimedByMe && !isMentionedInProj && !isManagerOfThis) {
        return;
      }

      const projCreatedDate = p.created_at ? new Date(p.created_at) : new Date();

      // A. Revisions / Redo Requests
      if (Array.isArray(p.revision_history) && p.revision_history.length > 0) {
        p.revision_history.forEach((rev, revIdx) => {
          if (!rev) return;
          const nid = `proj-redo-${p.id}-${rev.revision_id || rev.requested_at || revIdx}`;
          const isRead = readSet.has(nid);
          const revDate = rev.requested_at ? new Date(rev.requested_at) : projCreatedDate;

          list.push({
            id: nid,
            category: "revision",
            title: `Revision / Redo Requested 🔄`,
            body: `${rev.requested_by_name} requested redo on "${p.title}"`,
            detail: rev.issues_and_changes || "Issues found; please revise deliverables.",
            authorName: rev.requested_by_name,
            projectName: p.title,
            project: p,
            targetDepartmentName: p.target_department_name,
            rawTime: rev.requested_at || p.updated_at || p.created_at,
            formattedTime: revDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            formattedDate: revDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
            read: isRead,
            priority: p.priority,
          });
        });
      }

      // B. Transfers & Handoffs / Direct Assignments
      if (Array.isArray(p.transfer_history) && p.transfer_history.length > 0) {
        p.transfer_history.forEach((tr, trIdx) => {
          if (!tr) return;
          const toEmail = (tr.to_agent_email || "").toLowerCase().trim();
          const fromEmail = (tr.from_agent_email || "").toLowerCase().trim();
          const isToMe = toEmail && toEmail === userEmail;
          const isFromMe = fromEmail && fromEmail === userEmail;

          if (isToMe || (!isFromMe && (isManagerOfThis || isSuperAdmin || isCreator || isDeptMember))) {
            const nid = `proj-transfer-${p.id}-${tr.transferred_at || trIdx}`;
            const isRead = readSet.has(nid);
            const trDate = tr.transferred_at ? new Date(tr.transferred_at) : projCreatedDate;

            list.push({
              id: nid,
              category: "transfer",
              title: isToMe ? `Project Assigned / Transferred to You 🔄` : `Project Transferred / Assigned 🔄`,
              body: isToMe
                ? `"${p.title}" was transferred to you by ${tr.from_agent_name}`
                : `${tr.from_agent_name} transferred "${p.title}" to ${tr.to_agent_name}`,
              detail: tr.reason ? `Reason / Note: "${tr.reason}"` : undefined,
              authorName: tr.from_agent_name,
              authorEmail: tr.from_agent_email,
              projectName: p.title,
              project: p,
              targetDepartmentName: p.target_department_name,
              rawTime: tr.transferred_at || p.updated_at || p.created_at,
              formattedTime: trDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              formattedDate: trDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
              read: isRead,
              priority: p.priority,
            });
          }
        });
      }

      // C. Comments & Direct @Mentions
      if (Array.isArray(p.comments)) {
        p.comments.forEach((c: ProjectComment) => {
          if (!c) return;
          const authorEmail = (c.author_email || "").toLowerCase().trim();
          if (authorEmail === userEmail) return;

          const isTaggingMe = isUserMentionedInComment(c, userEmail, userName);
          if (isTaggingMe || isClaimedByMe || isCreator || isManagerOfThis || isSuperAdmin) {
            const nid = `proj-c-${p.id}-${c.id}`;
            const isRead = readSet.has(nid);
            const cDate = c.created_at ? new Date(c.created_at) : projCreatedDate;

            list.push({
              id: nid,
              category: isTaggingMe ? "mention" : "comment",
              title: isTaggingMe ? `🎯 Tagged You in ${p.title}` : `Comment on ${p.title} 💬`,
              body: `${c.author_name}: "${c.content.slice(0, 90)}"`,
              detail: c.content,
              authorName: c.author_name,
              authorEmail: c.author_email,
              authorRole: c.author_role,
              projectName: p.title,
              project: p,
              targetDepartmentName: p.target_department_name,
              rawTime: c.created_at,
              formattedTime: cDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              formattedDate: cDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
              read: isRead,
              priority: p.priority,
            });
          }
        });
      }

      // D. Project Completed & Delivered
      if (p.status === "done" && p.completed_at) {
        const compEmail = (p.completed_by_email || "").toLowerCase().trim();
        if (compEmail !== userEmail || isSuperAdmin) {
          const nid = `proj-done-${p.id}-${p.completed_at}`;
          const isRead = readSet.has(nid);
          const compDate = new Date(p.completed_at);

          list.push({
            id: nid,
            category: "project_done",
            title: `Project Completed & Delivered ✅`,
            body: `"${p.title}" marked completed by ${p.completed_by_name || "Agent"}`,
            detail: p.completion_notes ? `Delivery Note: "${p.completion_notes}"` : undefined,
            authorName: p.completed_by_name,
            projectName: p.title,
            project: p,
            targetDepartmentName: p.target_department_name,
            rawTime: p.completed_at,
            formattedTime: compDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            formattedDate: compDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
            read: isRead,
            priority: p.priority,
          });
        }
      }

      // E. Project Claimed (ONLY if project was organically claimed from queue, NOT when transferred/directly assigned!)
      const hasTransfers = Array.isArray(p.transfer_history) && p.transfer_history.length > 0;
      if (p.claimed_by_email && p.claimed_at && !hasTransfers) {
        const claimEmail = (p.claimed_by_email || "").toLowerCase().trim();
        if (claimEmail !== userEmail || isSuperAdmin) {
          const nid = `proj-claim-${p.id}-${p.claimed_at}`;
          const isRead = readSet.has(nid);
          const claimDate = new Date(p.claimed_at);

          list.push({
            id: nid,
            category: "project_claimed",
            title: `Project Claimed 🚀`,
            body: `${p.claimed_by_name || "Agent"} claimed and is working on "${p.title}"`,
            authorName: p.claimed_by_name,
            projectName: p.title,
            project: p,
            targetDepartmentName: p.target_department_name,
            rawTime: p.claimed_at,
            formattedTime: claimDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            formattedDate: claimDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
            read: isRead,
            priority: p.priority,
          });
        }
      }

      // F. New Project Created
      if (p.created_at && !isCreator) {
        const nid = `proj-create-${p.id}`;
        const isRead = readSet.has(nid);

        list.push({
          id: nid,
          category: "project_created",
          title: `New Project: ${p.title} 📂`,
          body: `Assigned to ${p.target_department_name} • ${p.priority.toUpperCase()} Priority`,
          detail: p.description,
          authorName: p.created_by_name,
          projectName: p.title,
          project: p,
          targetDepartmentName: p.target_department_name,
          rawTime: p.created_at,
          formattedTime: projCreatedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          formattedDate: projCreatedDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
          read: isRead,
          priority: p.priority,
        });
      }
    });

    list.sort((a, b) => new Date(b.rawTime).getTime() - new Date(a.rawTime).getTime());

    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    return list.filter((item) => {
      const contentKey = `${item.category}:::${item.title}:::${item.body}`;
      if (seenIds.has(item.id) || seenKeys.has(contentKey)) return false;
      seenIds.add(item.id);
      seenKeys.add(contentKey);
      return true;
    });
  }, [projects, userEmail, userName, isSuperAdmin, isManagerOfProject, userAssignedDepts, readNotifIds]);

  const unreadProjectNotifsCount = useMemo(() => {
    return allProjectNotifications.filter((n) => !n.read).length;
  }, [allProjectNotifications]);

  const displayedProjectNotifications = useMemo(() => {
    let list = allProjectNotifications;

    if (notifCategoryTab === "revisions") {
      list = list.filter((n) => n.category === "revision");
    } else if (notifCategoryTab === "transfers") {
      list = list.filter((n) => n.category === "transfer");
    } else if (notifCategoryTab === "mentions") {
      list = list.filter((n) => n.category === "mention" || n.category === "comment");
    } else if (notifCategoryTab === "completed") {
      list = list.filter((n) => n.category === "project_done" || n.category === "project_claimed");
    }

    if (notifStatusFilter === "unread") {
      list = list.filter((n) => !n.read);
    } else if (notifStatusFilter === "read") {
      list = list.filter((n) => n.read);
    }

    if (notifSearchQuery.trim()) {
      const q = notifSearchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          (n.detail && n.detail.toLowerCase().includes(q)) ||
          (n.authorName && n.authorName.toLowerCase().includes(q)) ||
          n.projectName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allProjectNotifications, notifCategoryTab, notifStatusFilter, notifSearchQuery]);

  const handleToggleProjectNotifRead = (id: string) => {
    const updated = new Set(readNotifIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    saveReadIds(updated);
    setReadNotifIds(updated);
  };

  const handleMarkAllProjectNotifsRead = () => {
    const updated = new Set(readNotifIds);
    allProjectNotifications.forEach((n) => updated.add(n.id));
    saveReadIds(updated);
    setReadNotifIds(updated);
    if (userEmail) {
      markAllProjectsSeen(userEmail).catch(() => {});
    }
    toast.success("✅ All project activity marked as read.");
  };

  const getNotifCategoryIcon = (category: string) => {
    switch (category) {
      case "revision":
        return <RotateCcw className="size-4 text-amber-400" />;
      case "transfer":
        return <ArrowLeftRight className="size-4 text-purple-400" />;
      case "mention":
        return <AtSign className="size-4 text-purple-400" />;
      case "comment":
        return <MessageSquare className="size-4 text-blue-400" />;
      case "project_done":
        return <CheckCircle2 className="size-4 text-emerald-400" />;
      case "project_claimed":
        return <FolderKanban className="size-4 text-emerald-400" />;
      case "project_created":
        return <FolderKanban className="size-4 text-violet-400" />;
      default:
        return <Bell className="size-4 text-violet-400" />;
    }
  };

  const getNotifCategoryBadge = (category: string) => {
    switch (category) {
      case "revision":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <RotateCcw className="size-2.5" /> Revision Request
          </span>
        );
      case "transfer":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <ArrowLeftRight className="size-2.5" /> Project Transfer
          </span>
        );
      case "mention":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/25 text-purple-300 border border-purple-500/40 animate-pulse">
            <AtSign className="size-2.5" /> Tagged You
          </span>
        );
      case "comment":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <MessageSquare className="size-2.5" /> Discussion
          </span>
        );
      case "project_done":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="size-2.5" /> Completed
          </span>
        );
      case "project_claimed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <FolderKanban className="size-2.5" /> In Progress
          </span>
        );
      case "project_created":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/80 border border-white/10">
            <FolderKanban className="size-2.5" /> New Task
          </span>
        );
      default:
        return null;
    }
  };

  // Helper to reliably resolve working agent's full display name
  const getResolvedAgentName = useCallback(
    (email?: string | null, fallbackName?: string | null) => {
      if (!email && !fallbackName) return "Unassigned Agent";
      const clean = (email || "").toLowerCase().trim();
      const registered = registeredAgents.find((a) => a.email.toLowerCase().trim() === clean);
      if (registered?.name && registered.name.trim()) return registered.name;
      if (fallbackName && fallbackName.trim() && fallbackName !== "A" && !fallbackName.includes("@")) return fallbackName;
      if (clean) return clean.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return "Agent";
    },
    [registeredAgents]
  );

  // Unread badge check for current agent
  const isProjectUnreadForUser = useCallback((p: Project) => {
    if (!userEmail) return false;
    const seen = (p.seen_by_emails || []).map((e) => (e || "").toLowerCase().trim());
    return !seen.includes(userEmail);
  }, [userEmail]);

  // Auto-mark all projects as seen when visiting this page
  useEffect(() => {
    if (!userEmail) return;
    markAllProjectsSeen(userEmail).catch(() => {});
  }, [userEmail]);

  // Mark single project seen when opened
  useEffect(() => {
    if (activeDetailPageProject && userEmail) {
      markProjectSeen(activeDetailPageProject.id, userEmail).catch(() => {});
    }
  }, [activeDetailPageProject?.id, userEmail]);

  // Auto-mark notifications as read when viewing notifications
  useEffect(() => {
    if (viewMode === "notifications" && allProjectNotifications.length > 0) {
      const unreadItems = allProjectNotifications.filter((n) => !readNotifIds.has(n.id));
      if (unreadItems.length > 0) {
        const updated = new Set(readNotifIds);
        unreadItems.forEach((n) => updated.add(n.id));
        saveReadIds(updated);
        setReadNotifIds(updated);
        try {
          window.localStorage.setItem("teals_notifs_last_viewed_at", String(Date.now()));
          const bc = new BroadcastChannel("teals-crm-projects-sync");
          bc.postMessage({ type: "notifs_marked_read" });
          bc.close();
        } catch {}
        if (userEmail) {
          markAllProjectsSeen(userEmail).catch(() => {});
        }
      }
    }
  }, [viewMode, allProjectNotifications, userEmail, readNotifIds]);

  // Helper to get agent role, department name & designation
  const getAgentInfo = useCallback(
    (email?: string | null) => {
      if (!email) return { role: "agent", departmentId: "production-house", departmentName: "Production House", designation: undefined };
      const clean = email.toLowerCase().trim();
      const isAdmin = isAdminEmail(clean);
      if (isAdmin) {
        return { role: "admin", departmentId: undefined, departmentName: "Administration", designation: undefined };
      }

      // 1. Check if department manager
      const managedDept = departments.find(
        (d) => d.manager_email && d.manager_email.toLowerCase().trim() === clean
      );
      if (managedDept) {
        const agentObj = registeredAgents.find((a) => a.email.toLowerCase().trim() === clean);
        return {
          role: "manager",
          departmentId: managedDept.id,
          departmentName: managedDept.name,
          designation: agentObj?.designation,
        };
      }

      // 2. Check if member of a department
      const memberDept = departments.find(
        (d) => Array.isArray(d.member_emails) && d.member_emails.some((m) => m.toLowerCase().trim() === clean)
      );

      const agentObj = registeredAgents.find((a) => a.email.toLowerCase().trim() === clean);
      const effectiveDeptId = memberDept?.id || agentObj?.departmentId || (
        clean.includes("emma") ? "ecommerce-department" : clean.includes("jack") ? "sales-department" : "production-house"
      );

      const effectiveDeptName = memberDept?.name || agentObj?.departmentName || (
        effectiveDeptId === "ecommerce-department"
          ? "E-commerce Department"
          : effectiveDeptId === "sales-department"
          ? "Sales Department"
          : "Production House"
      );

      return {
        role: "agent",
        departmentId: effectiveDeptId,
        departmentName: effectiveDeptName,
        designation: agentObj?.designation,
      };
    },
    [departments, registeredAgents]
  );

  // ── ROLE BADGE HELPER (Exact Match with Admin Panel) ───────────────────────
  const renderRoleBadge = (role?: "admin" | "working_agent" | string | null, email?: string) => {
    const clean = (email || "").toLowerCase().trim();
    const info = getAgentInfo(clean);
    const isAdmin = role === "admin" || info.role === "admin" || (clean && isAdminEmail(clean));

    if (isAdmin) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wide shrink-0 shadow-sm">
          <Shield className="size-2.5 text-amber-400" />
          <span>Admin</span>
        </span>
      );
    }

    if (info.role === "manager") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-purple-500/25 to-pink-500/25 text-purple-200 border border-purple-500/40 shadow-sm">
          <Sparkles className="size-2.5 text-purple-300 shrink-0" />
          <span>{info.departmentName} Manager</span>
        </span>
      );
    }

    // Working Agent with department badge
    if (info.departmentId === "ecommerce-department") {
      return (
        <div className="inline-flex items-center gap-1 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm shrink-0">
            <ShoppingBag className="size-2.5 text-emerald-400 shrink-0" />
            <span>E-commerce Working Agent</span>
          </span>
          {info.designation && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium bg-purple-500/15 text-purple-200 border border-purple-500/30 shadow-sm shrink-0">
              {info.designation}
            </span>
          )}
        </div>
      );
    }

    if (info.departmentId === "sales-department") {
      return (
        <div className="inline-flex items-center gap-1 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm shrink-0">
            <PhoneCall className="size-2.5 text-blue-400 shrink-0" />
            <span>Sales Working Agent</span>
          </span>
          {info.designation && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium bg-purple-500/15 text-purple-200 border border-purple-500/30 shadow-sm shrink-0">
              {info.designation}
            </span>
          )}
        </div>
      );
    }

    // Default / Production House
    const isProd = info.departmentId === "production-house" || !info.departmentId;
    const DeptIcon = isProd ? Palette : Building2;
    const deptLabel = isProd ? "Production Working Agent" : `${info.departmentName} Working Agent`;

    return (
      <div className="inline-flex items-center gap-1 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 shadow-sm shrink-0">
          <DeptIcon className="size-2.5 text-violet-400 shrink-0" />
          <span>{deptLabel}</span>
        </span>
        {info.designation && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium bg-purple-500/15 text-purple-200 border border-purple-500/30 shadow-sm shrink-0">
            {info.designation}
          </span>
        )}
      </div>
    );
  };

  const renderCommentContent = (content: string) => {
    const names = registeredAgents.map((a) => a.name).filter(Boolean);
    const sortedNames = [...names].sort((a, b) => b.length - a.length);
    const namesPattern = sortedNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

    const regex = namesPattern
      ? new RegExp(`(@(?:${namesPattern}|[a-zA-Z0-9_]+))`, "gi")
      : /(@[a-zA-Z0-9_]+(?:\s+[a-zA-Z0-9_]+)?)/g;

    const parts = content.split(regex);
    return (
      <p className="text-xs text-white/90 whitespace-pre-wrap leading-relaxed mt-1">
        {parts.map((part, i) => {
          if (part && part.startsWith("@")) {
            return (
              <span
                key={i}
                className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-[11px] font-bold bg-violet-500/25 text-violet-200 border border-violet-500/40"
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  };

  // ── REMOVE / CANCEL PERMISSION CHECK ──────────────────────────────────────
  const canCancelProject = useCallback(
    (p: Project) => {
      if (!userEmail) return false;
      if (isSuperAdmin) return true;
      return isManagerOfProject(p);
    },
    [userEmail, isSuperAdmin, isManagerOfProject]
  );

  const handleCancelProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalProject) return;
    if (!cancelReason.trim()) {
      toast.error("Please enter a mandatory explanation (Vazahat) for removing this project.");
      return;
    }

    const targetId = cancelModalProject.id;
    const cleanUser = userEmail.toLowerCase().trim();
    const managerDept = departments.find(
      (d) => d.manager_email && d.manager_email.toLowerCase().trim() === cleanUser
    );
    const roleTitle = isSuperAdmin ? "Super Admin" : managerDept ? `${managerDept.name} Manager` : "Department Manager";

    const now = new Date().toISOString();
    const optimisticCancelled: Project = {
      ...cancelModalProject,
      status: "cancelled",
      cancelled_at: now,
      cancelled_by_name: userName,
      cancelled_by_email: userEmail,
      cancelled_by_role: roleTitle,
      cancellation_reason: cancelReason.trim(),
      updated_at: now,
    };

    // Instant optimistic update
    setProjects((prev) => prev.map((item) => (item.id === targetId ? optimisticCancelled : item)));
    if (activeDetailPageProject && activeDetailPageProject.id === targetId) {
      setActiveDetailPageProject(optimisticCancelled);
    }

    try {
      await cancelProjectWithReason(
        targetId,
        { name: userName, email: userEmail, role: roleTitle },
        cancelReason.trim()
      );
      toast.success(`🚫 Project "${cancelModalProject.title}" has been removed and saved in CRM history with reason.`);
      setCancelModalProject(null);
      setCancelReason("");
      await loadData();
    } catch (err: any) {
      toast.error("Failed to remove project: " + err.message);
      await loadData();
    }
  };

  // ── DELETE PERMISSION CHECKS & HANDLERS ────────────────────────────────────
  const canDeleteProject = useCallback(
    (p: Project) => {
      if (!userEmail) return false;
      return isSuperAdmin;
    },
    [userEmail, isSuperAdmin]
  );

  const canDeleteComment = useCallback(
    (p: Project, cmt: ProjectComment) => {
      if (!userEmail) return false;
      if (isSuperAdmin) return true;
      const managerDept = getManagerDepartment(userEmail);
      if (managerDept && managerDept.id === p.target_department_id) {
        return true;
      }
      if (cmt.author_email?.toLowerCase().trim() === userEmail) {
        return true;
      }
      return false;
    },
    [userEmail, isSuperAdmin, getManagerDepartment]
  );

  const handleDeleteProject = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    if (!canDeleteProject(p)) {
      toast.error("Unauthorized: Only Super Admins can permanently delete projects.");
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete project "${p.title}"?`)) {
      return;
    }

    setProjects((prev) => prev.filter((item) => item.id !== p.id));
    if (activeDetailPageProject && activeDetailPageProject.id === p.id) {
      setActiveDetailPageProject(null);
      navigate({
        search: (prev: any) => ({ ...prev, projectId: undefined }),
        replace: true,
      });
    }

    try {
      const ok = await deleteProject(p.id, userEmail);
      if (ok) {
        toast.success(`🗑️ Project "${p.title}" deleted permanently.`);
      }
    } catch (err: any) {
      toast.error("Failed to delete project: " + err.message);
      await loadData();
    }
  };

  const handleDeleteComment = async (e: React.MouseEvent, p: Project, commentId: string) => {
    e.stopPropagation();
    const cmt = (p.comments || []).find((c) => c.id === commentId);
    if (!cmt || !canDeleteComment(p, cmt)) {
      toast.error("Unauthorized to delete this comment.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    deletedCommentIdsRef.current.add(commentId);

    setProjects((prev) =>
      prev.map((item) =>
        item.id === p.id
          ? { ...item, comments: (item.comments || []).filter((c) => c.id !== commentId) }
          : item
      )
    );
    if (activeDetailPageProject && activeDetailPageProject.id === p.id) {
      setActiveDetailPageProject((prev) =>
        prev
          ? { ...prev, comments: (prev.comments || []).filter((c) => c.id !== commentId) }
          : null
      );
    }

    try {
      const updated = await deleteProjectComment(p.id, commentId, userEmail);
      if (updated) {
        const sanitizedComments = (updated.comments || []).filter(
          (c) => !deletedCommentIdsRef.current.has(c.id)
        );
        const finalUpdated = { ...updated, comments: sanitizedComments };
        setProjects((prev) => prev.map((item) => (item.id === finalUpdated.id ? finalUpdated : item)));
        if (activeDetailPageProject && activeDetailPageProject.id === finalUpdated.id) {
          setActiveDetailPageProject(finalUpdated);
        }
        toast.success("🗑️ Comment deleted.");
      }
    } catch (err: any) {
      deletedCommentIdsRef.current.delete(commentId);
      toast.error("Failed to delete comment: " + err.message);
      await loadData();
    }
  };

  // ── ACTION HANDLERS ────────────────────────────────────────────────────────
  const handleOpenProject = async (p: Project) => {
    // Check permission: If cancelled, regular agent cannot open!
    if (!canUserOpenProject(p)) {
      setAccessRestrictedModalProject(p);
      return;
    }

    setActiveDetailPageProject(p);
    navigate({
      search: (prev: any) => ({ ...prev, projectId: p.id }),
      replace: true,
    });
    if (userEmail) {
      setProjects((prev) =>
        prev.map((item) =>
          item.id === p.id
            ? { ...item, seen_by_emails: Array.from(new Set([...(item.seen_by_emails || []), userEmail])) }
            : item
        )
      );
      markProjectSeen(p.id, userEmail).catch(() => {});
    }
  };

  const handleClaim = async (p: Project) => {
    try {
      const res = await claimProject(p.id, userEmail, userName);
      if (res) {
        toast.success(`🚀 You claimed project: "${p.title}"!`);
        await loadData();
      }
    } catch (err: any) {
      toast.error("Failed to claim project: " + err.message);
    }
  };

  // Permission: Who can mark a project as Completed / Done?
  // Only Super Admin, the Department Manager of that project, or the Assigned Agent working on it!
  const canMarkProjectDone = useCallback(
    (p: Project) => {
      if (!userEmail) return false;
      if (isSuperAdmin) return true;
      if (isManagerOfProject(p)) return true;
      const cleanUser = userEmail.toLowerCase().trim();
      const cleanClaimed = (p.claimed_by_email || "").toLowerCase().trim();
      if (cleanClaimed && cleanClaimed === cleanUser) return true;
      return false;
    },
    [userEmail, isSuperAdmin, isManagerOfProject]
  );

  const handleOpenDoneModal = (p: Project) => {
    if (!canMarkProjectDone(p)) {
      toast.error("Unauthorized: Only the assigned agent working on this project, their department manager, or an Admin can mark it completed.");
      return;
    }
    setDoneModalProject(p);
    setDoneModalNotes("");
  };

  const handleConfirmDoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doneModalProject) return;

    const targetProject = doneModalProject;
    const now = new Date().toISOString();
    const notes = doneModalNotes.trim();

    const optimisticDone: Project = {
      ...targetProject,
      status: "done",
      completed_at: now,
      completed_by_name: userName,
      completed_by_email: userEmail,
      completed_by_role: isSuperAdmin ? "admin" : "working_agent",
      completion_notes: notes || null,
      updated_at: now,
    };

    setProjects((prev) => prev.map((item) => (item.id === targetProject.id ? optimisticDone : item)));
    if (activeDetailPageProject && activeDetailPageProject.id === targetProject.id) {
      setActiveDetailPageProject(optimisticDone);
    }
    setDoneModalProject(null);
    setDoneModalNotes("");

    try {
      const res = await markProjectDone(targetProject.id, { name: userName, email: userEmail }, notes || undefined);
      if (res) {
        toast.success(`✅ Marked "${targetProject.title}" as Completed & Delivered!`);
        setProjects((prev) => prev.map((item) => (item.id === res.id ? res : item)));
        if (activeDetailPageProject && activeDetailPageProject.id === res.id) {
          setActiveDetailPageProject(res);
        }
      }
    } catch (err: any) {
      toast.error("Failed to complete project: " + err.message);
      await loadData();
    }
  };

  const handleQuickStatusChange = (p: Project, newStatus: string) => {
    if (newStatus === "done") {
      handleOpenDoneModal(p);
    } else if (newStatus === "redo") {
      if (!isSuperAdmin && !isManagerOfProject(p) && p.created_by_email.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
        toast.error("Unauthorized: Only Managers, Admins, or Project Creators can request redo revisions.");
        return;
      }
      setRedoModalProject(p);
      setRedoForm({ issuesAndChanges: "" });
    } else if (newStatus === "cancelled") {
      if (!canCancelProject(p)) {
        toast.error("Unauthorized: Only Department Managers or Super Admins can remove/cancel projects.");
        return;
      }
      setCancelModalProject(p);
      setCancelReason("");
    } else if (newStatus === "in_progress" && !p.claimed_by_email) {
      handleClaim(p);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailPageProject || !commentText.trim() || submittingComment) return;

    const text = commentText.trim();
    const replyTarget = replyingToModalComment;
    const reply_to = replyTarget
      ? {
          comment_id: replyTarget.id,
          author_name: replyTarget.author_name,
          author_email: replyTarget.author_email,
          content_snippet: replyTarget.content.slice(0, 80),
        }
      : null;

    setSubmittingComment(true);
    setCommentText("");
    setReplyingToModalComment(null);

    const mentionMatches = text.match(/@([a-zA-Z0-9_\s]+?)(?=\s|$|[.,!?])/g) || [];
    const mentions = mentionMatches.map((m) => m.replace(/^@/, "").trim()).filter(Boolean);
    const role: "admin" | "working_agent" = isSuperAdmin ? "admin" : "working_agent";

    const now = new Date().toISOString();
    const optimisticComment: ProjectComment = {
      id: "cmt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      project_id: activeDetailPageProject.id,
      author_name: userName,
      author_email: userEmail,
      author_role: role,
      content: text,
      mentions,
      reply_to,
      created_at: now,
    };

    const prevPending = pendingCommentsRef.current.get(activeDetailPageProject.id) || [];
    pendingCommentsRef.current.set(activeDetailPageProject.id, [...prevPending, optimisticComment]);

    const optProj: Project = {
      ...activeDetailPageProject,
      comments: [...(activeDetailPageProject.comments || []), optimisticComment],
      updated_at: now,
      seen_by_emails: Array.from(new Set([...(activeDetailPageProject.seen_by_emails || []), userEmail])),
    };
    setActiveDetailPageProject(optProj);
    setProjects((prev) => prev.map((item) => (item.id === optProj.id ? optProj : item)));

    try {
      const updated = await addProjectComment(activeDetailPageProject.id, {
        id: optimisticComment.id,
        author_name: userName,
        author_email: userEmail,
        author_role: role,
        content: text,
        mentions,
        reply_to,
        created_at: now,
      });

      if (updated) {
        const currPending = pendingCommentsRef.current.get(activeDetailPageProject.id) || [];
        pendingCommentsRef.current.set(
          activeDetailPageProject.id,
          currPending.filter((c) => c.id !== optimisticComment.id)
        );

        setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setActiveDetailPageProject(updated);
        if (typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem("teals_crm_projects");
            if (cached) {
              const list = JSON.parse(cached);
              if (Array.isArray(list)) {
                const updatedList = list.map((p: any) => (p.id === updated.id ? updated : p));
                localStorage.setItem("teals_crm_projects", JSON.stringify(updatedList));
              }
            }
          } catch {}
        }
      }
      toast.success("💬 Comment posted to project discussion!");
    } catch (err: any) {
      const currPending = pendingCommentsRef.current.get(activeDetailPageProject.id) || [];
      pendingCommentsRef.current.set(
        activeDetailPageProject.id,
        currPending.filter((c) => c.id !== optimisticComment.id)
      );
      toast.error("Failed to post comment: " + err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    const uploadedList: Array<{ name: string; url: string; size: number; type: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;
        const res = await fetch("/api/projects-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_file",
            fileName: file.name,
            fileBase64: base64,
            contentType: file.type || "application/octet-stream",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            uploadedList.push({
              name: file.name,
              url: data.url,
              size: file.size,
              type: file.type,
            });
          }
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      } catch (err: any) {
        toast.error(`Error uploading ${file.name}: ${err.message}`);
      }
    }

    if (uploadedList.length > 0) {
      setNewProject((prev) => ({
        ...prev,
        attached_files: [...(prev.attached_files || []), ...uploadedList],
      }));
      toast.success(`📎 ${uploadedList.length} file(s) attached successfully!`);
    }

    setUploadingFile(false);
    e.target.value = "";
  };

  // Upload extra file to an existing project in Detail View
  const handleAttachExtraFilesToActiveProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeDetailPageProject) return;

    setUploadingExtraFile(true);
    const uploadedList: Array<{ name: string; url: string; size: number; type: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;
        const res = await fetch("/api/projects-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_file",
            fileName: file.name,
            fileBase64: base64,
            contentType: file.type || "application/octet-stream",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            uploadedList.push({
              name: file.name,
              url: data.url,
              size: file.size,
              type: file.type,
            });
          }
        }
      } catch (err: any) {
        toast.error(`Error uploading ${file.name}: ${err.message}`);
      }
    }

    if (uploadedList.length > 0) {
      const updatedFiles = [...(activeDetailPageProject.attached_files || []), ...uploadedList];
      const now = new Date().toISOString();
      const updatedProj: Project = {
        ...activeDetailPageProject,
        attached_files: updatedFiles,
        updated_at: now,
      };

      setActiveDetailPageProject(updatedProj);
      setProjects((prev) => prev.map((item) => (item.id === updatedProj.id ? updatedProj : item)));

      try {
        await supabase.from("projects").update({ attached_files: updatedFiles, updated_at: now }).eq("id", updatedProj.id);
        toast.success(`📎 ${uploadedList.length} new file(s) attached and saved!`);
      } catch (err: any) {
        toast.error("Failed to save attachments to database: " + err.message);
      }
    }

    setUploadingExtraFile(false);
    e.target.value = "";
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingProjectRef.current || submittingProject) return;
    if (!newProject.title.trim()) {
      toast.error("Please enter a project title.");
      return;
    }

    isCreatingProjectRef.current = true;
    setSubmittingProject(true);

    const targetDept = departments.find((d) => d.id === newProject.target_department_id);
    const targetDeptName = targetDept?.name || "Production House";
    const userDeptName = userDept?.name || "Operations";
    const isProdHouse = newProject.target_department_id === "production-house";

    let directAssignee: { email: string; name: string; role: string } | undefined = undefined;
    if (newProject.direct_assignee_email?.trim()) {
      const chosenEmail = newProject.direct_assignee_email.trim().toLowerCase();
      const isEcom = isEcommerceDepartment(newProject.target_department_id, targetDeptName);
      const isDeptManager = targetDept?.manager_email && targetDept.manager_email.toLowerCase().trim() === chosenEmail;
      const isAdm = isAdminEmail(chosenEmail);

      // Only allow manager or admin for E-commerce department; disallow working agents
      if (!isEcom || isDeptManager || isAdm) {
        const agentObj = registeredAgents.find((a) => a.email.toLowerCase().trim() === chosenEmail);
        const info = getAgentInfo(chosenEmail);
        directAssignee = {
          email: chosenEmail,
          name: agentObj?.name || getResolvedAgentName(chosenEmail),
          role: info.role || "working_agent",
        };
      }
    }

    try {
      await createNewProject({
        title: newProject.title.trim(),
        target_department_id: newProject.target_department_id,
        target_department_name: targetDeptName,
        subcategory: newProject.subcategory,
        priority: newProject.priority,
        client_name: newProject.client_company.trim() || "Brand Client",
        client_email: newProject.client_email.trim(),
        client_phone: isProdHouse ? "" : newProject.client_phone.trim(),
        client_company: newProject.client_company.trim(),
        budget_or_value: isProdHouse ? "" : newProject.budget_or_value.trim(),
        description: newProject.description.trim(),
        attachments_links: newProject.attachments_links.trim(),
        attached_files: newProject.attached_files || [],
        created_by_email: userEmail,
        created_by_name: userName,
        created_by_role: isSuperAdmin ? "admin" : "working_agent",
        created_by_department: userDeptName,
        claimed_by_email: directAssignee?.email,
        claimed_by_name: directAssignee?.name,
        claimed_by_role: directAssignee?.role,
      });

      toast.success(
        directAssignee
          ? `🎉 Project created & directly assigned to ${directAssignee.name}!`
          : `🎉 Project created & placed in ${targetDeptName} queue!`
      );
      setCreateModalOpen(false);
      setNewProject({
        title: "",
        target_department_id: "production-house",
        subcategory: "Graphic Design",
        priority: "medium",
        client_company: "",
        client_email: "",
        client_phone: "",
        budget_or_value: "",
        description: "",
        attachments_links: "",
        attached_files: [],
        direct_assignee_email: "",
      });
      await loadData();
    } catch (err: any) {
      toast.error("Failed to create project: " + err.message);
    } finally {
      setSubmittingProject(false);
      isCreatingProjectRef.current = false;
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalProject) return;

    let chosenEmail = (transferForm.targetAgentEmail || "").trim().toLowerCase();
    const targetDept = departments.find((d) => d.id === transferForm.targetDepartmentId);
    const isEcom = isEcommerceDepartment(transferForm.targetDepartmentId, targetDept?.name);
    const isDeptManager = targetDept?.manager_email && targetDept.manager_email.toLowerCase().trim() === chosenEmail;
    const isAdm = isAdminEmail(chosenEmail);

    // If transferring to E-commerce, working agents cannot be directly assigned; clear to place in queue
    if (isEcom && !isDeptManager && !isAdm) {
      chosenEmail = "";
    }

    const targetAgent = chosenEmail
      ? registeredAgents.find((a) => a.email.toLowerCase() === chosenEmail)
      : null;
    const info = chosenEmail ? getAgentInfo(chosenEmail) : null;

    try {
      await transferProject(
        transferModalProject.id,
        { name: userName, email: userEmail },
        {
          name: chosenEmail
            ? targetAgent?.name || getResolvedAgentName(chosenEmail)
            : "Unassigned Queue",
          email: chosenEmail,
          role: info?.role || "working_agent",
        },
        targetDept ? { id: targetDept.id, name: targetDept.name } : undefined,
        transferForm.reason.trim()
      );

      toast.success(`🔁 Project transferred successfully!`);
      setTransferModalProject(null);
      setTransferForm({ targetAgentEmail: "", targetDepartmentId: "", reason: "" });
      await loadData();
    } catch (err: any) {
      toast.error("Failed to transfer project: " + err.message);
    }
  };

  const handleRedoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redoModalProject) return;
    if (!redoForm.issuesAndChanges.trim()) {
      toast.error("Please explain what issues were found / changes required.");
      return;
    }

    try {
      await requestProjectRedo(
        redoModalProject.id,
        { name: userName, email: userEmail },
        redoForm.issuesAndChanges.trim()
      );

      toast.success(`🔄 Redo / Revision request dispatched! Project moved back to Active queue.`);
      setRedoModalProject(null);
      setRedoForm({ issuesAndChanges: "" });
      await loadData();
    } catch (err: any) {
      toast.error("Failed to submit redo request: " + err.message);
    }
  };

  // Department Management Handlers
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptForm.name.trim()) return;

    const slug = newDeptForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const subcats = newDeptForm.subcategoriesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const newDept: Department = {
      id: slug || `dept_${Date.now()}`,
      name: newDeptForm.name.trim(),
      description: newDeptForm.description.trim() || "Dynamic Business Department",
      icon: newDeptForm.icon || "Briefcase",
      color: newDeptForm.color || "violet",
      manager_email: null,
      manager_name: null,
      member_emails: [],
      subcategories: subcats.length > 0 ? subcats : ["General Tasks"],
      created_at: new Date().toISOString(),
      created_by: userEmail,
    };

    const updated = [...departments, newDept];
    await saveAllDepartments(updated);
    setDepartments(updated);
    setNewDeptForm({
      name: "",
      description: "",
      icon: "Briefcase",
      color: "violet",
      subcategoriesStr: "Graphic Design, Web Development",
    });
    toast.success(`🏢 Department "${newDept.name}" created!`);
  };

  const handleAssignManager = async (deptId: string, managerEmail: string) => {
    const cleanEmail = (managerEmail || "").toLowerCase().trim();
    const targetAgent = registeredAgents.find((a) => a.email.toLowerCase().trim() === cleanEmail);
    try {
      const updated = await assignDepartmentManagerSync({
        deptId,
        managerEmail: cleanEmail || null,
        managerName: targetAgent?.name || (cleanEmail ? cleanEmail.split("@")[0] : null),
        departments,
      });
      setDepartments(updated);
      const targetDept = updated.find((d) => d.id === deptId);
      if (cleanEmail) {
        toast.success(`🏢 Assigned ${targetAgent?.name || cleanEmail} as Manager of ${targetDept?.name || "Department"}!`);
      } else {
        toast.success(`Manager unassigned from ${targetDept?.name || "Department"}.`);
      }
      loadData();
    } catch (err: any) {
      toast.error("Failed to assign manager: " + err.message);
    }
  };

  const handleAssignTeamLeader = async (deptId: string, leaderEmail: string) => {
    const cleanEmail = (leaderEmail || "").toLowerCase().trim();
    const targetAgent = registeredAgents.find((a) => a.email.toLowerCase().trim() === cleanEmail);
    const targetDept = departments.find((d) => d.id === deptId);
    try {
      const updated = departments.map((d) => {
        if (d.id === deptId) {
          return {
            ...d,
            team_leader_email: cleanEmail || null,
            team_leader_name: targetAgent?.name || (cleanEmail ? cleanEmail.split("@")[0] : null),
          };
        }
        return d;
      });
      setDepartments(updated);
      await saveAllDepartments(updated);

      if (cleanEmail) {
        await updateUserRoleAndTitleSync({
          email: cleanEmail,
          role: "team_leader",
          roleTitle: targetDept?.name ? `${targetDept.name} Team Leader` : "Team Leader",
          departmentId: deptId,
          departmentName: targetDept?.name || null,
        });
        toast.success(`🌟 Assigned ${targetAgent?.name || cleanEmail} as Team Leader of ${targetDept?.name || "Department"}!`);
      } else {
        toast.success(`Team Leader unassigned from ${targetDept?.name || "Department"}.`);
      }
      loadData();
    } catch (err: any) {
      toast.error("Failed to assign team leader: " + err.message);
    }
  };

  const handleToggleMember = async (deptId: string, memberEmail: string) => {
    const clean = memberEmail.toLowerCase().trim();
    const updated = departments.map((d) => {
      if (d.id === deptId) {
        const isMember = d.member_emails.includes(clean);
        const nextMembers = isMember
          ? d.member_emails.filter((m) => m !== clean)
          : [...d.member_emails, clean];
        return { ...d, member_emails: nextMembers };
      }
      return {
        ...d,
        member_emails: d.member_emails.filter((m) => m !== clean),
      };
    });

    await saveAllDepartments(updated);
    setDepartments(updated);
    toast.success("Agent department membership saved!");
  };

  const handleDeleteDepartment = async (deptId: string) => {
    if (["production-house", "ecommerce-department", "sales-department"].includes(deptId)) {
      toast.error("Core default departments cannot be deleted.");
      return;
    }
    if (!confirm("Are you sure you want to delete this department?")) return;

    const updated = departments.filter((d) => d.id !== deptId);
    await saveAllDepartments(updated);
    setDepartments(updated);
    if (selectedDeptId === deptId) setSelectedDeptId("all");
    toast.success("Department deleted.");
  };

  // Subcategories for current target dept
  const currentDeptSubcategories = useMemo(() => {
    const target = departments.find((d) => d.id === newProject.target_department_id);
    return target?.subcategories || ["General Task"];
  }, [departments, newProject.target_department_id]);

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse";
      case "high":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "medium":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    }
  };

  // ── ROW RENDERER COMPONENT ────────────────────────────────────────────────
  const renderProjectRow = (p: Project) => {
    const isUnread = isProjectUnreadForUser(p);
    const isClaimed = Boolean(p.claimed_by_email);
    const isClaimedByMe = (p.claimed_by_email || "").toLowerCase().trim() === userEmail;
    const canOperateProject = isSuperAdmin || canManageDepartments || isClaimedByMe;
    const isTagged = isUserMentionedInProject(p, userEmail, userName);
    const isCancelled = p.status === "cancelled";
    const isDone = p.status === "done";
    const canOpen = canUserOpenProject(p);

    return (
      <div
        key={p.id}
        onClick={() => handleOpenProject(p)}
        className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
          isCancelled
            ? "bg-rose-950/15 border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-950/25"
            : isDone
            ? "bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-950/20"
            : isUnread
            ? "bg-violet-950/25 border-violet-500/50 shadow-md shadow-violet-950/30 hover:border-violet-400"
            : "bg-white/[0.02] border-white/10 hover:border-violet-500/40 hover:bg-white/[0.04]"
        }`}
      >
        {/* Left Column: Status Icon + Title + Badges + Scope preview */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
          {/* Status Checkbox / Icon */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (isDone) {
                setRedoModalProject(p);
                setRedoForm({ issuesAndChanges: "" });
              } else if (!isCancelled && isClaimed) {
                handleOpenDoneModal(p);
              } else if (!isCancelled && !isClaimed) {
                handleClaim(p);
              }
            }}
            className="shrink-0"
            title={
              isDone
                ? "Completed (Click to request redo/revision)"
                : isCancelled
                ? "Removed by Manager"
                : isClaimed
                ? "In Progress (Click to mark done)"
                : "Unclaimed (Click to claim)"
            }
          >
            {isDone ? (
              <div className="size-6 rounded-lg bg-emerald-600/30 border border-emerald-500/60 grid place-items-center text-emerald-400 group-hover:scale-110 transition-transform shadow-sm">
                <Check className="size-3.5" />
              </div>
            ) : isCancelled ? (
              <div className="size-6 rounded-lg bg-rose-600/20 border border-rose-500/50 grid place-items-center text-rose-400 shadow-sm">
                <AlertCircle className="size-3.5" />
              </div>
            ) : isClaimed ? (
              <div className="size-6 rounded-lg bg-blue-600/20 border border-blue-500/50 grid place-items-center text-blue-400 group-hover:border-emerald-500 transition-colors shadow-sm">
                <Clock className="size-3.5 animate-spin-slow" />
              </div>
            ) : (
              <div className="size-6 rounded-lg bg-white/5 border border-white/20 grid place-items-center text-white/40 group-hover:border-violet-400 transition-colors shadow-sm">
                <div className="size-2 rounded-full bg-amber-400" />
              </div>
            )}
          </div>

          {/* Title & Info */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-sm font-bold truncate transition-colors ${
                  isCancelled
                    ? "text-rose-200 line-through opacity-85"
                    : isDone
                    ? "text-white/90 group-hover:text-emerald-300"
                    : "text-white group-hover:text-violet-300"
                }`}
              >
                {p.title}
              </span>

              {isUnread && !isCancelled && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-extrabold shadow-sm animate-pulse">
                  NEW
                </span>
              )}

              {/* Department badge */}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white/80 border border-white/10 shrink-0">
                {p.target_department_name}
              </span>

              {/* Subcategory badge */}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-600/20 text-violet-300 border border-violet-500/30 shrink-0">
                {p.subcategory}
              </span>

              {/* Revision Badge if redo requested */}
              {p.revision_history && p.revision_history.length > 0 && !isCancelled && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  <RotateCcw className="size-2.5 text-amber-400" />
                  <span>Revision #{p.revision_history.length}</span>
                </span>
              )}

              {/* Mentioned Indicator */}
              {isTagged && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-500/25 text-purple-300 border border-purple-500/40 animate-pulse shrink-0">
                  <AtSign className="size-2.5 text-purple-400" />
                  <span>Tagged You</span>
                </span>
              )}
            </div>

            {/* Description Snippet or Delivery / Cancellation Reason */}
            {isCancelled ? (
              <p className="text-xs text-rose-300/80 truncate font-medium">
                🚫 Removed: "{p.cancellation_reason || "Removed by department manager"}"
              </p>
            ) : isDone && p.completion_notes ? (
              <p className="text-xs text-emerald-300/70 truncate italic">
                ✓ Delivered: "{p.completion_notes}"
              </p>
            ) : (
              p.description && (
                <p className="text-xs text-white/50 truncate">
                  {p.description}
                </p>
              )
            )}
            {/* Mobile-only compact metadata line (Agent + Priority) */}
            <div className="flex sm:hidden items-center justify-between gap-2 pt-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="text-white/40">Agent:</span>
                {isCancelled ? (
                  <span className="text-rose-400/80 font-medium">Archived</span>
                ) : isClaimed ? (
                  <span className="font-bold text-emerald-300 truncate">
                    {isClaimedByMe
                      ? `${getResolvedAgentName(p.claimed_by_email, p.claimed_by_name)} (You)`
                      : getResolvedAgentName(p.claimed_by_email, p.claimed_by_name)}
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium">Unclaimed</span>
                )}
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${priorityBadge(p.priority)}`}>
                {p.priority.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Brand / Company Column */}
        <div className="hidden md:block w-36 shrink-0">
          <span className="text-[10px] text-white/40 block font-medium">Brand / Client</span>
          <span className="text-xs font-semibold text-white/90 truncate block">
            {p.client_company || "Standard Brand"}
          </span>
        </div>

        {/* Assigned Agent Column */}
        <div className="hidden lg:block w-56 shrink-0">
          <span className="text-[10px] text-white/40 block font-medium mb-1">Assigned Agent</span>
          {isCancelled ? (
            <span className="text-xs text-rose-400/80 font-medium">Archived</span>
          ) : isClaimed ? (
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-full bg-emerald-600/30 border border-emerald-500/50 grid place-items-center text-[10px] font-bold text-emerald-300 shrink-0 shadow-sm">
                {(getResolvedAgentName(p.claimed_by_email, p.claimed_by_name) || "A").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-emerald-300 truncate block leading-tight" title={p.claimed_by_email || ""}>
                  {isClaimedByMe ? `${getResolvedAgentName(p.claimed_by_email, p.claimed_by_name)} (You)` : getResolvedAgentName(p.claimed_by_email, p.claimed_by_name)}
                </span>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {renderRoleBadge(p.claimed_by_role, p.claimed_by_email)}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-xs text-amber-400 font-medium">Unclaimed</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClaim(p);
                }}
                className="px-2 py-0.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition-colors"
              >
                + Claim
              </button>
            </div>
          )}
        </div>

        {/* Priority Column */}
        <div className="hidden sm:block w-20 shrink-0 text-center">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border block ${priorityBadge(p.priority)}`}>
            {p.priority.toUpperCase()}
          </span>
        </div>

        {/* Right Controls Wrapper (Full-width bottom bar on mobile, inline on sm+) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t border-white/5 sm:border-t-0 shrink-0">
          {/* Live Status Selector Column */}
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {isCancelled ? (
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shadow-sm">
                <AlertCircle className="size-3" />
                <span>REMOVED</span>
              </span>
            ) : isDone ? (
              <select
                value="done"
                onChange={(e) => handleQuickStatusChange(p, e.target.value)}
                style={{ colorScheme: "dark" }}
                className="h-7 px-2.5 rounded-xl bg-[#0b0f19] border border-emerald-500/40 text-xs font-semibold text-emerald-300 focus:outline-none focus:border-emerald-400 cursor-pointer hover:border-emerald-500/70 transition-colors shadow-sm"
              >
                <option value="done" className="bg-[#0b0f19] text-emerald-300" style={{ backgroundColor: "#0b0f19", color: "#6ee7b7" }}>✓ Completed (Done)</option>
                <option value="redo" className="bg-[#0b0f19] text-amber-300" style={{ backgroundColor: "#0b0f19", color: "#fcd34d" }}>🔄 Request Redo / Revision</option>
                {canCancelProject(p) && <option value="cancelled" className="bg-[#0b0f19] text-rose-300" style={{ backgroundColor: "#0b0f19", color: "#fca5a5" }}>🚫 Cancel / Remove</option>}
              </select>
            ) : (
              <select
                value={isClaimed ? "in_progress" : "active"}
                onChange={(e) => handleQuickStatusChange(p, e.target.value)}
                style={{ colorScheme: "dark" }}
                className="h-7 px-2.5 rounded-xl bg-[#0b0f19] border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-violet-500 cursor-pointer hover:border-white/30 transition-colors shadow-sm"
              >
                <option value={isClaimed ? "in_progress" : "active"} className="bg-[#0b0f19] text-white" style={{ backgroundColor: "#0b0f19", color: "#ffffff" }}>
                  {isClaimed ? "⏳ In Progress" : "⚪ Active (Unclaimed)"}
                </option>
                {canMarkProjectDone(p) && <option value="done" className="bg-[#0b0f19] text-emerald-300" style={{ backgroundColor: "#0b0f19", color: "#6ee7b7" }}>✅ Mark Done</option>}
                {canCancelProject(p) && <option value="cancelled" className="bg-[#0b0f19] text-rose-300" style={{ backgroundColor: "#0b0f19", color: "#fca5a5" }}>🚫 Cancel / Remove</option>}
              </select>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isCancelled && !isClaimed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClaim(p);
                }}
                className="sm:hidden px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition-colors"
              >
                + Claim
              </button>
            )}

            {/* Attached Files & Comments Count Badges */}
            {p.attached_files && p.attached_files.length > 0 && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 border border-white/10 text-[11px] font-semibold text-white/70"
                title={`${p.attached_files.length} files attached`}
              >
                <Paperclip className="size-3 text-violet-400" />
                <span className="hidden sm:inline">{p.attached_files.length}</span>
              </span>
            )}

            <span
              className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-semibold transition-colors ${
                (p.comments || []).length > 0
                  ? "bg-violet-600/20 text-violet-300 border-violet-500/30"
                  : "bg-white/5 text-white/50 border-white/10"
              }`}
              title={`${p.comments?.length || 0} discussion comments`}
            >
              <MessageSquare className="size-3 text-violet-400" />
              <span>{p.comments?.length || 0}</span>
            </span>

            {/* Action Button: Open Project */}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenProject(p);
              }}
              className="h-8 px-2.5 text-xs text-violet-300 hover:text-white hover:bg-violet-600/20 rounded-xl gap-1"
              title="Open Full Project Details & Discussion"
            >
              {!canOpen ? (
                <Lock className="size-3.5 text-rose-400" />
              ) : (
                <>
                  <span className="hidden xl:inline">Details</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // ── KANBAN CARD RENDERER (FOR CLEAN BOARD VIEW) ───────────────────────────
  const renderProjectCard = (p: Project) => {
    const isUnread = isProjectUnreadForUser(p);
    const isClaimed = Boolean(p.claimed_by_email);
    const isClaimedByMe = (p.claimed_by_email || "").toLowerCase().trim() === userEmail;
    const isTagged = isUserMentionedInProject(p, userEmail, userName);
    const isCancelled = p.status === "cancelled";
    const isDone = p.status === "done";
    const canOpen = canUserOpenProject(p);

    return (
      <div
        key={p.id}
        onClick={() => handleOpenProject(p)}
        className={`group flex flex-col justify-between gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer select-none shadow-sm ${
          isCancelled
            ? "bg-rose-950/15 border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-950/25"
            : isDone
            ? "bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-950/20"
            : isUnread
            ? "bg-violet-950/25 border-violet-500/50 shadow-md shadow-violet-950/30 hover:border-violet-400"
            : "bg-white/[0.02] border-white/10 hover:border-violet-500/40 hover:bg-white/[0.04]"
        }`}
      >
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge(p.priority)}`}>
              {p.priority.toUpperCase()}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white/80 border border-white/10">
              {p.target_department_name}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-600/20 text-violet-300 border border-violet-500/30">
              {p.subcategory}
            </span>
          </div>

          {isUnread && !isCancelled && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-extrabold shadow-sm animate-pulse shrink-0">
              NEW
            </span>
          )}
        </div>

        {/* Title & Scope */}
        <div className="space-y-1.5">
          <h3
            className={`text-sm font-bold leading-snug transition-colors ${
              isCancelled
                ? "text-rose-200 line-through opacity-85"
                : isDone
                ? "text-white/90 group-hover:text-emerald-300"
                : "text-white group-hover:text-violet-300"
            }`}
          >
            {p.title}
          </h3>

          {/* Revision or Tagged indicators */}
          {(isTagged || (p.revision_history && p.revision_history.length > 0 && !isCancelled)) && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {p.revision_history && p.revision_history.length > 0 && !isCancelled && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <RotateCcw className="size-2.5 text-amber-400" />
                  <span>Revision #{p.revision_history.length}</span>
                </span>
              )}

              {isTagged && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-500/25 text-purple-300 border border-purple-500/40 animate-pulse">
                  <AtSign className="size-2.5 text-purple-400" />
                  <span>Tagged You</span>
                </span>
              )}
            </div>
          )}

          {isCancelled ? (
            <p className="text-xs text-rose-300/80 line-clamp-2 font-medium">
              🚫 Removed: "{p.cancellation_reason || "Removed by department manager"}"
            </p>
          ) : isDone && p.completion_notes ? (
            <p className="text-xs text-emerald-300/70 line-clamp-2 italic">
              ✓ Delivered: "{p.completion_notes}"
            </p>
          ) : (
            p.description && (
              <p className="text-xs text-white/50 line-clamp-2">
                {p.description}
              </p>
            )
          )}
        </div>

        {/* Brand & Client Info */}
        <div className="flex items-center justify-between text-xs text-white/60 border-t border-white/5 pt-2">
          <span className="text-[11px] text-white/40">Brand / Client:</span>
          <span className="text-xs font-semibold text-white/90 truncate max-w-[180px]">
            {p.client_company || "Standard Brand"}
          </span>
        </div>

        {/* Assigned Agent */}
        <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
          <span className="text-[11px] text-white/40">Assigned Agent:</span>
          {isCancelled ? (
            <span className="text-xs text-rose-400/80 font-medium">Archived</span>
          ) : isClaimed ? (
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-full bg-emerald-600/30 border border-emerald-500/40 grid place-items-center text-[9px] font-bold text-emerald-300 shrink-0">
                {(getResolvedAgentName(p.claimed_by_email, p.claimed_by_name) || "A").slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-emerald-300 truncate max-w-[130px]" title={p.claimed_by_email || ""}>
                {isClaimedByMe ? `${getResolvedAgentName(p.claimed_by_email, p.claimed_by_name)} (You)` : getResolvedAgentName(p.claimed_by_email, p.claimed_by_name)}
              </span>
              {renderRoleBadge(p.claimed_by_role, p.claimed_by_email)}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-amber-400 font-medium">Unclaimed</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClaim(p);
                }}
                className="px-2 py-0.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition-colors"
              >
                + Claim
              </button>
            </div>
          )}
        </div>

        {/* Card Footer: Live Status Selector + Comments/Files + Open Button */}
        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3" onClick={(e) => e.stopPropagation()}>
          {isCancelled ? (
            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shadow-sm">
              <AlertCircle className="size-3" />
              <span>REMOVED</span>
            </span>
          ) : isDone ? (
            <select
              value="done"
              onChange={(e) => handleQuickStatusChange(p, e.target.value)}
              style={{ colorScheme: "dark" }}
              className="h-7 px-2 rounded-xl bg-[#0b0f19] border border-emerald-500/40 text-xs font-semibold text-emerald-300 focus:outline-none focus:border-emerald-400 cursor-pointer hover:border-emerald-500/70 transition-colors max-w-[140px] shadow-sm"
            >
              <option value="done" className="bg-[#0b0f19] text-emerald-300" style={{ backgroundColor: "#0b0f19", color: "#6ee7b7" }}>✓ Completed (Done)</option>
              <option value="redo" className="bg-[#0b0f19] text-amber-300" style={{ backgroundColor: "#0b0f19", color: "#fcd34d" }}>🔄 Request Redo / Revision</option>
              {canCancelProject(p) && <option value="cancelled" className="bg-[#0b0f19] text-rose-300" style={{ backgroundColor: "#0b0f19", color: "#fca5a5" }}>🚫 Cancel / Remove</option>}
            </select>
          ) : (
            <select
              value={isClaimed ? "in_progress" : "active"}
              onChange={(e) => handleQuickStatusChange(p, e.target.value)}
              style={{ colorScheme: "dark" }}
              className="h-7 px-2 rounded-xl bg-[#0b0f19] border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-violet-500 cursor-pointer hover:border-white/30 transition-colors max-w-[140px] shadow-sm"
            >
              <option value={isClaimed ? "in_progress" : "active"} className="bg-[#0b0f19] text-white" style={{ backgroundColor: "#0b0f19", color: "#ffffff" }}>
                {isClaimed ? "⏳ In Progress" : "⚪ Active Queue"}
              </option>
              {canMarkProjectDone(p) && <option value="done" className="bg-[#0b0f19] text-emerald-300" style={{ backgroundColor: "#0b0f19", color: "#6ee7b7" }}>✅ Mark Done</option>}
              {canCancelProject(p) && <option value="cancelled" className="bg-[#0b0f19] text-rose-300" style={{ backgroundColor: "#0b0f19", color: "#fca5a5" }}>🚫 Cancel / Remove</option>}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            {p.attached_files && p.attached_files.length > 0 && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 border border-white/10 text-[11px] font-semibold text-white/70"
                title={`${p.attached_files.length} files attached`}
              >
                <Paperclip className="size-3 text-violet-400" />
                <span>{p.attached_files.length}</span>
              </span>
            )}

            <span
              className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-semibold transition-colors ${
                (p.comments || []).length > 0
                  ? "bg-violet-600/20 text-violet-300 border-violet-500/30"
                  : "bg-white/5 text-white/50 border-white/10"
              }`}
              title={`${p.comments?.length || 0} discussion comments`}
            >
              <MessageSquare className="size-3 text-violet-400" />
              <span>{p.comments?.length || 0}</span>
            </span>

            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenProject(p);
              }}
              className="h-7 px-2 text-xs text-violet-300 hover:text-white hover:bg-violet-600/20 rounded-xl gap-1"
              title="Open Project Details & Discussion"
            >
              {!canOpen ? (
                <Lock className="size-3 text-rose-400" />
              ) : (
                <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 pb-16">
      {!activeDetailPageProject && (
        <>
          {/* ── TOP HEADER (Shown in Image 3 / 2) ─────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <FolderKanban className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex flex-wrap items-center gap-2">
                Project Management & Workflows
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase tracking-wider">
                  Live Sync
                </span>
              </h1>
              <p className="text-xs text-white/50">
                Inter-department project delegation, task claiming, and revision tracking across Production, E-commerce & Sales.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle: Row-wise List vs Board vs Notifications */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => handleSetViewMode("list")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shrink-0 ${
                viewMode === "list"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                  : "text-white/60 hover:text-white"
              }`}
              title="Asana Row-wise List View"
            >
              <LayoutList className="size-3.5" />
              <span>List View</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode("board")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shrink-0 ${
                viewMode === "board"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                  : "text-white/60 hover:text-white"
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="size-3.5" />
              <span>Board View</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode("notifications")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shrink-0 ${
                viewMode === "notifications"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                  : "text-white/60 hover:text-white"
              }`}
              title="Project Notifications & Activity History"
            >
              <Bell className="size-3.5 text-violet-400" />
              <span className="sm:hidden">Notifications</span>
              <span className="hidden sm:inline">Notifications & Activity</span>
              {unreadProjectNotifsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-rose-600 text-white animate-pulse">
                  {unreadProjectNotifsCount}
                </span>
              )}
            </button>
          </div>

          <Button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white gap-1.5 rounded-xl h-9"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </Button>

          {canManageDepartments && (
            <Button
              onClick={() => setDeptModalOpen(true)}
              variant="outline"
              size="sm"
              className="border-violet-500/40 bg-violet-950/30 hover:bg-violet-900/40 text-xs text-violet-200 gap-1.5 rounded-xl h-9 font-semibold"
            >
              <Settings2 className="size-4 text-violet-400" />
              <span>Manage Departments</span>
            </Button>
          )}

          {isAssignedToAnyDept && (
            <Button
              onClick={() => setCreateModalOpen(true)}
              size="sm"
              className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold gap-1.5 rounded-xl h-9 shadow-lg shadow-violet-600/25"
            >
              <Plus className="size-4" />
              <span>Create New Project</span>
            </Button>
          )}
        </div>
      </div>

      {!isAssignedToAnyDept ? (
        /* ── UNASSIGNED AGENT NOTICE ── */
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 rounded-3xl border border-white/10 bg-white/[0.02] max-w-xl mx-auto my-6 space-y-4">
          <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 grid place-items-center text-amber-400">
            <Building2 className="size-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">No Department Assigned Yet</h2>
            <p className="text-xs text-white/60 mt-2 leading-relaxed max-w-md">
              You are currently not assigned to any department. Once an administrator assigns you to a department (such as Production House, E-commerce, or Sales), your department projects, workflow queues, and tasks will appear here automatically.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              variant="outline"
              size="sm"
              disabled={refreshing}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white gap-2 rounded-xl h-9 px-4"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Check Assignment Status</span>
            </Button>
          </div>
        </div>
      ) : viewMode === "notifications" ? (
        /* ── DEDICATED PROJECT NOTIFICATIONS & ACTIVITY HISTORY VIEW ── */
        <div className="space-y-6 animate-fade-in">
          {/* Header Banner */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-violet-950/40 via-purple-950/30 to-black/40 border border-violet-500/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="size-12 rounded-2xl bg-violet-600/25 border border-violet-500/40 grid place-items-center text-violet-300 shadow-md shrink-0">
                  <Bell className="size-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center gap-2 flex-wrap">
                    Project Notifications & Activity History
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono">
                      {allProjectNotifications.length} Total
                    </span>
                    {unreadProjectNotifsCount > 0 && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono animate-pulse">
                        {unreadProjectNotifsCount} New
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-white/60">
                    Live stream of revision requests, project transfers, direct @mentions, claimed tasks, and completions.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Mark all read */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleMarkAllProjectNotifsRead}
                  variant="outline"
                  size="sm"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white gap-1.5 rounded-xl h-9"
                >
                  <CheckCheck className="size-3.5 text-emerald-400" />
                  <span>Mark All as Read</span>
                </Button>
              </div>
            </div>

            {/* Category Filter Pills & Search */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-white/10">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setNotifCategoryTab("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                    notifCategoryTab === "all"
                      ? "bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-600/30"
                      : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Bell className="size-3" />
                  <span>All ({allProjectNotifications.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotifCategoryTab("revisions")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                    notifCategoryTab === "revisions"
                      ? "bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-600/30"
                      : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <RotateCcw className="size-3 text-amber-400" />
                  <span>Revisions ({allProjectNotifications.filter((n) => n.category === "revision").length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotifCategoryTab("transfers")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                    notifCategoryTab === "transfers"
                      ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30"
                      : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <ArrowLeftRight className="size-3 text-purple-400" />
                  <span>Transfers ({allProjectNotifications.filter((n) => n.category === "transfer").length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotifCategoryTab("mentions")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                    notifCategoryTab === "mentions"
                      ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30"
                      : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <AtSign className="size-3 text-blue-400" />
                  <span>Mentions & Discussion ({allProjectNotifications.filter((n) => n.category === "mention" || n.category === "comment").length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotifCategoryTab("completed")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                    notifCategoryTab === "completed"
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30"
                      : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  <span>Completed & Claimed ({allProjectNotifications.filter((n) => n.category === "project_done" || n.category === "project_claimed").length})</span>
                </button>
              </div>

              {/* Status Filter + Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <select
                  value={notifStatusFilter}
                  onChange={(e: any) => setNotifStatusFilter(e.target.value)}
                  style={{ colorScheme: "dark" }}
                  className="h-8 px-2.5 rounded-xl bg-[#0b0f19] border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-violet-500 cursor-pointer shadow-sm"
                >
                  <option value="all">All Read & Unread</option>
                  <option value="unread">🔴 Unread Only</option>
                  <option value="read">✓ Read Only</option>
                </select>

                <div className="relative w-full sm:w-60">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <Input
                    value={notifSearchQuery}
                    onChange={(e) => setNotifSearchQuery(e.target.value)}
                    placeholder="Search notifications..."
                    className="pl-8 h-8 bg-black/30 border-white/10 text-xs text-white rounded-xl focus:border-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notification Cards List */}
          {displayedProjectNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-white/10 bg-white/[0.02] space-y-3 max-w-lg mx-auto my-6">
              <div className="size-16 rounded-2xl bg-violet-500/10 border border-violet-500/30 grid place-items-center text-violet-400">
                <Bell className="size-8" />
              </div>
              <h3 className="text-base font-bold text-white">No Notifications Found</h3>
              <p className="text-xs text-white/50 leading-relaxed max-w-md">
                {notifSearchQuery || notifStatusFilter !== "all" || notifCategoryTab !== "all"
                  ? "No project notifications match your current filter criteria. Try resetting or selecting another category."
                  : "All quiet! As soon as team members create projects, transfer assignments, request revisions, or mention you, updates will show up here live."}
              </p>
              {(notifSearchQuery || notifStatusFilter !== "all" || notifCategoryTab !== "all") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNotifCategoryTab("all");
                    setNotifStatusFilter("all");
                    setNotifSearchQuery("");
                  }}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs rounded-xl h-8 mt-2"
                >
                  Reset Notification Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedProjectNotifications.map((n) => {
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      handleToggleProjectNotifRead(n.id);
                      handleOpenProject(n.project);
                    }}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer select-none space-y-3 ${
                      !n.read
                        ? "bg-violet-950/20 border-violet-500/40 hover:border-violet-400 hover:bg-violet-950/30 shadow-md shadow-violet-950/20"
                        : "bg-white/[0.02] border-white/10 hover:border-violet-500/30 hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* Top row: Category Badge + Project Title + Department + Time + Unread indicator */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {getNotifCategoryBadge(n.category)}

                        <span className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md">
                          {n.title}
                        </span>

                        {n.targetDepartmentName && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-white/80 border border-white/10">
                            {n.targetDepartmentName}
                          </span>
                        )}

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge(n.priority)}`}>
                          {n.priority.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs shrink-0">
                        <span className="text-[11px] text-white/40 font-mono">
                          {n.formattedDate} • {n.formattedTime}
                        </span>
                        {!n.read && (
                          <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* Notification Body / Message */}
                    <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
                      <p className="text-xs text-white/90 font-medium">
                        {n.body}
                      </p>
                      {n.detail && (
                        <p className="text-xs text-white/60 italic bg-white/[0.02] p-2 rounded-lg border-l-2 border-violet-500/60 mt-1">
                          "{n.detail}"
                        </p>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-xs text-white/50">
                      <div className="flex items-center gap-2 truncate">
                        <span>Project: <strong className="text-violet-300 font-medium">{n.projectName}</strong></span>
                        {n.authorName && (
                          <>
                            <span>•</span>
                            <span>By: <strong className="text-white/80 font-medium">{n.authorName}</strong></span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleProjectNotifRead(n.id);
                          }}
                          className="h-7 px-2.5 text-[11px] text-white/60 hover:text-white rounded-lg gap-1"
                          title={n.read ? "Mark as Unread" : "Mark as Read"}
                        >
                          {n.read ? <EyeOff className="size-3 text-white/40" /> : <Eye className="size-3 text-emerald-400" />}
                          <span className="hidden sm:inline">{n.read ? "Mark unread" : "Mark read"}</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleProjectNotifRead(n.id);
                            handleOpenProject(n.project);
                          }}
                          className="h-7 px-3 text-xs text-violet-300 hover:text-white hover:bg-violet-600/20 rounded-xl gap-1.5 font-bold"
                        >
                          <span>Open Project</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── DEPARTMENT WORKSPACE CAROUSEL / TABS ──────────────────────────── */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {isSuperAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDeptId("all");
                    if (userEmail) {
                      setProjects((prev) =>
                        prev.map((item) => ({
                          ...item,
                          seen_by_emails: Array.from(new Set([...(item.seen_by_emails || []), userEmail])),
                        }))
                      );
                      markAllProjectsSeen(userEmail).catch(() => {});
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                    selectedDeptId === "all"
                      ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20"
                      : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Layers className="size-3.5" />
                  <span>All Departments Feed</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30 font-mono">
                    {projects.length}
                  </span>
                </button>

                {departments.map((dept) => {
                  const IconComp = getDeptIcon(dept.icon);
                  const isSelected = selectedDeptId === dept.id;
                  const deptProjects = projects.filter((p) => p.target_department_id === dept.id);
                  const unreadCount = !isSelected ? deptProjects.filter((p) => isProjectUnreadForUser(p)).length : 0;

                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => {
                        setSelectedDeptId(dept.id);
                        if (userEmail) {
                          setProjects((prev) =>
                            prev.map((item) =>
                              item.target_department_id === dept.id
                                ? { ...item, seen_by_emails: Array.from(new Set([...(item.seen_by_emails || []), userEmail])) }
                                : item
                            )
                          );
                          markAllProjectsSeen(userEmail).catch(() => {});
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                        isSelected
                          ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <IconComp className="size-3.5" />
                      <span>{dept.name}</span>
                      {unreadCount > 0 && (
                        <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30 font-mono">
                        {deptProjects.length}
                      </span>
                    </button>
                  );
                })}

                {/* Mentions & Inquiries Tab for Admin */}
                {(() => {
                  const isMentionsTab = selectedDeptId === "mentions";
                  const unreadMentions = !isMentionsTab ? myMentionedProjects.filter((p) => isProjectUnreadForUser(p)).length : 0;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDeptId("mentions");
                        if (userEmail) {
                          setProjects((prev) =>
                            prev.map((item) =>
                              isUserMentionedInProject(item, userEmail, userName)
                                ? { ...item, seen_by_emails: Array.from(new Set([...(item.seen_by_emails || []), userEmail])) }
                                : item
                            )
                          );
                          markAllProjectsSeen(userEmail).catch(() => {});
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                        isMentionsTab
                          ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <AtSign className="size-3.5 text-purple-400" />
                      <span>@ Mentions & Inquiries</span>
                      {unreadMentions > 0 && (
                        <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30 font-mono">
                        {allInquiriesAndMentions.length}
                      </span>
                    </button>
                  );
                })()}
              </>
            ) : (
              /* Working Agent View: Only show their assigned department(s) and delegated projects */
              <>
                {userAssignedDepts.map((dept) => {
                  const IconComp = getDeptIcon(dept.icon);
                  const isSelected = selectedDeptId === dept.id;
                  const deptProjects = projects.filter((p) => p.target_department_id === dept.id);
                  const unreadCount = !isSelected ? deptProjects.filter((p) => isProjectUnreadForUser(p)).length : 0;

                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => {
                        setSelectedDeptId(dept.id);
                        if (userEmail) {
                          setProjects((prev) =>
                            prev.map((item) =>
                              item.target_department_id === dept.id
                                ? { ...item, seen_by_emails: Array.from(new Set([...(item.seen_by_emails || []), userEmail])) }
                                : item
                            )
                          );
                          markAllProjectsSeen(userEmail).catch(() => {});
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                        isSelected
                          ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <IconComp className="size-3.5" />
                      <span>{dept.name} (My Department)</span>
                      {unreadCount > 0 && (
                        <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30 font-mono">
                        {deptProjects.length}
                      </span>
                    </button>
                  );
                })}

                {/* Mentions & Tagged Activity Tab for Working Agent */}
                {(() => {
                  const isMentionsTab = selectedDeptId === "mentions";
                  const unreadMentions = !isMentionsTab ? myMentionedProjects.filter((p) => isProjectUnreadForUser(p)).length : 0;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDeptId("mentions");
                        if (userEmail) {
                          setProjects((prev) =>
                            prev.map((item) =>
                              isUserMentionedInProject(item, userEmail, userName)
                                ? { ...item, seen_by_emails: Array.from(new Set([...(item.seen_by_emails || []), userEmail])) }
                                : item
                            )
                          );
                          markAllProjectsSeen(userEmail).catch(() => {});
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                        isMentionsTab
                          ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <AtSign className="size-3.5 text-purple-400" />
                      <span>@ Mentions & Inquiries</span>
                      {unreadMentions > 0 && (
                        <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30 font-mono">
                        {allInquiriesAndMentions.length}
                      </span>
                    </button>
                  );
                })()}

                {/* Created / Delegated by me tab */}
                {projects.some((p) => p.created_by_email.toLowerCase().trim() === userEmail) && (
                  <button
                    type="button"
                    onClick={() => setSelectedDeptId("created_by_me")}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                      selectedDeptId === "created_by_me"
                        ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20"
                        : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Sparkles className="size-3.5 text-amber-400" />
                    <span>Projects Created by Me</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/30 font-mono">
                      {projects.filter((p) => p.created_by_email.toLowerCase().trim() === userEmail).length}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── SEARCH & FILTER CONTROLS ──────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="relative w-full sm:w-80">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, client, designer, dev..."
                className="pl-9 h-9 bg-black/30 border-white/10 text-xs text-white rounded-xl focus:border-violet-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="h-9 px-3 rounded-xl bg-[#0b0f19] border border-white/10 text-xs font-medium text-white focus:outline-none focus:border-violet-500 cursor-pointer shadow-sm"
              >
                <option value="all" className="bg-[#0b0f19] text-white" style={{ backgroundColor: "#0b0f19", color: "#ffffff" }}>All Statuses</option>
                <option value="active_inprogress" className="bg-[#0b0f19] text-white" style={{ backgroundColor: "#0b0f19", color: "#ffffff" }}>Active & In-Progress</option>
                <option value="done" className="bg-[#0b0f19] text-emerald-300" style={{ backgroundColor: "#0b0f19", color: "#6ee7b7" }}>Completed / Done</option>
                <option value="cancelled" className="bg-[#0b0f19] text-rose-300" style={{ backgroundColor: "#0b0f19", color: "#fca5a5" }}>Cancelled / Removed</option>
              </select>

              {/* Priority filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="h-9 px-3 rounded-xl bg-[#0b0f19] border border-white/10 text-xs font-medium text-white focus:outline-none focus:border-violet-500 cursor-pointer shadow-sm"
              >
                <option value="all" className="bg-[#0b0f19] text-white" style={{ backgroundColor: "#0b0f19", color: "#ffffff" }}>All Priorities</option>
                <option value="urgent" className="bg-[#0b0f19] text-rose-300" style={{ backgroundColor: "#0b0f19", color: "#fca5a5" }}>🔴 Urgent</option>
                <option value="high" className="bg-[#0b0f19] text-amber-300" style={{ backgroundColor: "#0b0f19", color: "#fcd34d" }}>🟠 High</option>
                <option value="medium" className="bg-[#0b0f19] text-blue-300" style={{ backgroundColor: "#0b0f19", color: "#93c5fd" }}>🔵 Medium</option>
                <option value="normal" className="bg-[#0b0f19] text-white" style={{ backgroundColor: "#0b0f19", color: "#ffffff" }}>⚪ Normal</option>
              </select>
            </div>
          </div>

          {/* ── CONDITIONAL VIEW: DEDICATED MENTIONS & INQUIRIES HUB VS TASK QUEUES ── */}
          {selectedDeptId === "mentions" ? (
            <div className="space-y-6 animate-fade-in">
              {/* Hub Banner Header */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-purple-950/40 via-violet-950/30 to-black/40 border border-purple-500/30 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="size-12 rounded-2xl bg-purple-600/25 border border-purple-500/40 grid place-items-center text-purple-300 shadow-md shrink-0">
                      <AtSign className="size-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-white flex items-center gap-2 flex-wrap">
                        Mentions & Discussion Inquiries Hub
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                          {allInquiriesAndMentions.length} Total
                        </span>
                      </h2>
                      <p className="text-xs text-white/60">
                        Live stream of direct @mentions, team queries, client notes, and discussion threads across all projects.
                      </p>
                    </div>
                  </div>

                  {/* Filter Toggle */}
                  <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMentionsFilter("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        mentionsFilter === "all"
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      All Activity ({allInquiriesAndMentions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMentionsFilter("mentions")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        mentionsFilter === "mentions"
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      <AtSign className="size-3" />
                      <span>Direct @Mentions ({allInquiriesAndMentions.filter((i) => i.isMentioned).length})</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Feed Cards List */}
              {filteredMentionsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-white/10 bg-white/[0.02] space-y-3 max-w-lg mx-auto my-6">
                  <div className="size-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 grid place-items-center text-purple-400">
                    <MessageSquare className="size-8" />
                  </div>
                  <h3 className="text-base font-bold text-white">No Mentions or Discussion Inquiries Found</h3>
                  <p className="text-xs text-white/50 leading-relaxed max-w-md">
                    {mentionsFilter === "mentions"
                      ? "Nobody has tagged you with @name in a project comment yet. When someone mentions you, it will appear here immediately."
                      : "No discussion comments or inquiries have been posted yet. Start a discussion inside any project to see it here in realtime."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredMentionsList.map((item) => (
                    <div
                      key={item.comment.id}
                      onClick={() => handleOpenProject(item.project)}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer select-none space-y-3 ${
                        item.isMentioned
                          ? "bg-purple-950/20 border-purple-500/40 hover:border-purple-400 hover:bg-purple-950/30 shadow-md shadow-purple-950/20"
                          : "bg-white/[0.02] border-white/10 hover:border-violet-500/40 hover:bg-white/[0.04]"
                      }`}
                    >
                      {/* Top Bar: Author Info + Project Title Badge + Timestamp */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                          <div className="size-7 rounded-full bg-violet-600/30 border border-violet-500/40 grid place-items-center text-xs font-bold text-violet-300 shrink-0 shadow-sm">
                            {(item.comment.author_name || "A").slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">
                              {item.comment.author_name || item.comment.author_email}
                            </span>
                            {renderRoleBadge(item.comment.author_role, item.comment.author_email)}

                            {item.isMentioned && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-500/25 text-purple-300 border border-purple-500/40 animate-pulse">
                                <AtSign className="size-2.5 text-purple-400" />
                                <span>Tagged You</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Project Badge & Time */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30 truncate max-w-[240px]">
                            📁 {item.project.title}
                          </span>
                          <span className="text-[11px] text-white/40">
                            {new Date(item.comment.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </div>
                      </div>

                      {/* Quoted reply banner if this comment was a reply */}
                      {item.comment.reply_to && (
                        <div className="p-2.5 rounded-xl bg-black/40 border-l-2 border-violet-500 text-xs text-white/60 space-y-0.5">
                          <span className="text-[11px] font-semibold text-violet-300">
                            ↩️ Replying to {item.comment.reply_to.author_name}:
                          </span>
                          <p className="italic line-clamp-1">"{item.comment.reply_to.content_snippet}"</p>
                        </div>
                      )}

                      {/* Comment Content */}
                      <div className="bg-black/30 p-3.5 rounded-xl border border-white/5">
                        {renderCommentContent(item.comment.content)}
                      </div>

                      {/* Card Footer: Department & Open Discussion Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                        <div className="flex items-center gap-2 text-[11px] text-white/50">
                          <span>Dept: <strong className="text-white/80">{item.project.target_department_name}</strong></span>
                          <span>•</span>
                          <span>Subcategory: <strong className="text-violet-300">{item.project.subcategory}</strong></span>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenProject(item.project);
                          }}
                          className="h-7 px-3 text-xs text-violet-300 hover:text-white hover:bg-violet-600/20 rounded-xl gap-1.5 font-bold"
                        >
                          <MessageSquare className="size-3.5 text-violet-400" />
                          <span>Open Discussion & Reply</span>
                          <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !hasAnyMatchingProjects ? (
            /* ── EMPTY STATE WHEN FILTERS MATCH NOTHING ─────────────────────── */
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-white/10 bg-white/[0.02] space-y-3 max-w-lg mx-auto my-6 animate-fade-in">
              <div className="size-16 rounded-2xl bg-white/5 border border-white/10 grid place-items-center text-white/40">
                <FolderKanban className="size-8" />
              </div>
              <h3 className="text-base font-bold text-white">No Matching Projects Found</h3>
              <p className="text-xs text-white/50 leading-relaxed max-w-md">
                No projects match your current filter criteria. Try adjusting or clearing your priority, status, or search filters.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setPriorityFilter("all");
                  setSearchQuery("");
                }}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs rounded-xl h-8 mt-2"
              >
                Reset All Filters
              </Button>
            </div>
          ) : viewMode === "list" ? (
            /* ── ROW-WISE (ASANA STYLE) VIEW ──────────────────────────────────── */
            <div className="space-y-6 animate-fade-in">
              {/* SECTION 1: ACTIVE & IN-PROGRESS PROJECTS (ON TOP) */}
              {shouldShowActiveSection && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setActiveSectionOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-blue-950/20 border border-blue-500/30 hover:bg-blue-950/30 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {activeSectionOpen ? (
                        <ChevronDown className="size-4 text-blue-400" />
                      ) : (
                        <ChevronRight className="size-4 text-blue-400" />
                      )}
                      <FolderKanban className="size-4 text-blue-400" />
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                        Active & In-Progress Tasks
                      </h2>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {activeProjects.length} Active
                    </span>
                  </button>

                  {activeSectionOpen && (
                    activeProjects.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.01] text-center space-y-1.5">
                        <FolderKanban className="size-6 mx-auto text-white/20" />
                        <p className="text-xs font-semibold text-white/50">No active tasks in this queue</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeProjects.map((p) => renderProjectRow(p))}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* SECTION 2: COMPLETED & DELIVERED PROJECTS */}
              {shouldShowDoneSection && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setCompletedSectionOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 hover:bg-emerald-950/30 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {completedSectionOpen ? (
                        <ChevronDown className="size-4 text-emerald-400" />
                      ) : (
                        <ChevronRight className="size-4 text-emerald-400" />
                      )}
                      <CheckCircle2 className="size-4 text-emerald-400" />
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                        Completed & Delivered Projects
                      </h2>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {doneProjects.length} Completed
                    </span>
                  </button>

                  {completedSectionOpen && (
                    doneProjects.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.01] text-center space-y-1.5">
                        <CheckCircle2 className="size-6 mx-auto text-white/20" />
                        <p className="text-xs font-semibold text-white/50">No completed projects yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {doneProjects.map((p) => renderProjectRow(p))}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* SECTION 3: CANCELLED / REMOVED PROJECTS (AT THE BOTTOM) */}
              {shouldShowCancelledSection && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setCancelledSectionOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-rose-950/20 border border-rose-500/30 hover:bg-rose-950/30 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {cancelledSectionOpen ? (
                        <ChevronDown className="size-4 text-rose-400" />
                      ) : (
                        <ChevronRight className="size-4 text-rose-400" />
                      )}
                      <AlertCircle className="size-4 text-rose-400" />
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                        Cancelled & Removed Archive
                      </h2>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {cancelledProjects.length} Removed
                    </span>
                  </button>

                  {cancelledSectionOpen && (
                    cancelledProjects.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.01] text-center space-y-1.5">
                        <AlertCircle className="size-6 mx-auto text-white/20" />
                        <p className="text-xs font-semibold text-white/50">No cancelled or removed projects</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cancelledProjects.map((p) => renderProjectRow(p))}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── BOARD VIEW (KANBAN 3 COLUMNS) ────────────────────────────── */
            <div className={`grid ${visibleColsCount === 3 ? "grid-cols-1 xl:grid-cols-3" : visibleColsCount === 2 ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"} gap-6 animate-fade-in items-start`}>
              {/* Column 1: Active */}
              {shouldShowActiveSection && (
                <div className="space-y-3.5 bg-white/[0.01] p-3 rounded-3xl border border-white/5">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="size-4 text-blue-400" />
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                        Active & In-Progress
                      </h2>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {activeProjects.length} Active
                    </span>
                  </div>
                  <div className="space-y-3">
                    {activeProjects.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-white/5 bg-white/[0.01] text-center space-y-1.5">
                        <FolderKanban className="size-6 mx-auto text-white/20" />
                        <p className="text-xs font-semibold text-white/50">
                          {selectedDeptId === "mentions" ? "No active mentions or discussion inquiries" : "No active tasks in this queue"}
                        </p>
                      </div>
                    ) : (
                      activeProjects.map((p) => renderProjectCard(p))
                    )}
                  </div>
                </div>
              )}

              {/* Column 2: Completed */}
              {shouldShowDoneSection && (
                <div className="space-y-3.5 bg-white/[0.01] p-3 rounded-3xl border border-white/5">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-400" />
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                        Completed & Delivered
                      </h2>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {doneProjects.length} Completed
                    </span>
                  </div>
                  <div className="space-y-3">
                    {doneProjects.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-white/5 bg-white/[0.01] text-center space-y-1.5">
                        <CheckCircle2 className="size-6 mx-auto text-white/20" />
                        <p className="text-xs font-semibold text-white/50">No completed projects yet</p>
                      </div>
                    ) : (
                      doneProjects.map((p) => renderProjectCard(p))
                    )}
                  </div>
                </div>
              )}

              {/* Column 3: Cancelled */}
              {shouldShowCancelledSection && (
                <div className="space-y-3.5 bg-white/[0.01] p-3 rounded-3xl border border-white/5">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-rose-400" />
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                        Cancelled & Removed
                      </h2>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {cancelledProjects.length} Removed
                    </span>
                  </div>
                  <div className="space-y-3">
                    {cancelledProjects.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-white/5 bg-white/[0.01] text-center space-y-1.5">
                        <AlertCircle className="size-6 mx-auto text-white/20" />
                        <p className="text-xs font-semibold text-white/50">No cancelled or removed projects</p>
                      </div>
                    ) : (
                      cancelledProjects.map((p) => renderProjectCard(p))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </>
      )}

      {/* ── DEDICATED FULL PROJECT DETAIL PAGE / VIEW ────────────────────── */}
      {activeDetailPageProject && (
        <div className="w-full animate-fade-in space-y-6">
          {/* Top Bar: Back button + Breadcrumb + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveDetailPageProject(null);
                  navigate({
                    search: (prev: any) => ({ ...prev, projectId: undefined }),
                    replace: true,
                  });
                }}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 rounded-xl h-9 px-3"
              >
                <ArrowLeft className="size-4" />
                <span>Back to Project List</span>
              </Button>

              <div className="flex items-center gap-2 text-xs text-white/50">
                <span>Projects</span>
                <span>/</span>
                <span className="text-violet-300 font-semibold">{activeDetailPageProject.target_department_name}</span>
                <span>/</span>
                <span className="text-white/80 font-mono text-[11px]">#{activeDetailPageProject.id}</span>
              </div>
            </div>

            {/* Status & Quick Actions Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {activeDetailPageProject.status === "cancelled" ? (
                  <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/50 flex items-center gap-1.5 shadow-sm">
                    <AlertCircle className="size-3.5 text-rose-400" />
                    <span>REMOVED / CANCELLED</span>
                  </span>
                ) : activeDetailPageProject.status === "done" ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    <span>COMPLETED & DELIVERED</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    <span>{activeDetailPageProject.claimed_by_email ? "IN PROGRESS" : "ACTIVE QUEUE"}</span>
                  </span>
                )}
              </div>

              {/* Actions */}
              {!activeDetailPageProject.claimed_by_email && activeDetailPageProject.status !== "cancelled" && (
                <Button
                  size="sm"
                  onClick={() => handleClaim(activeDetailPageProject)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl h-8 px-3"
                >
                  Claim Project
                </Button>
              )}

              {activeDetailPageProject.status !== "cancelled" && activeDetailPageProject.status !== "done" && activeDetailPageProject.claimed_by_email && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTransferModalProject(activeDetailPageProject);
                      setTransferForm({
                        targetAgentEmail: activeDetailPageProject.claimed_by_email || "",
                        targetDepartmentId: activeDetailPageProject.target_department_id,
                        reason: "",
                      });
                    }}
                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs rounded-xl h-8 gap-1"
                  >
                    <ArrowLeftRight className="size-3.5" />
                    <span>Transfer</span>
                  </Button>

                  {canMarkProjectDone(activeDetailPageProject) && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenDoneModal(activeDetailPageProject)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl h-8 px-3 gap-1 shadow-sm"
                    >
                      <Check className="size-3.5" />
                      <span>Mark Done</span>
                    </Button>
                  )}
                </>
              )}

              {activeDetailPageProject.status === "done" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setRedoModalProject(activeDetailPageProject);
                    setRedoForm({ issuesAndChanges: "" });
                  }}
                  className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl h-8 gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Redo Project</span>
                </Button>
              )}

              {activeDetailPageProject.status !== "cancelled" && canCancelProject(activeDetailPageProject) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCancelModalProject(activeDetailPageProject);
                    setCancelReason("");
                  }}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs rounded-xl h-8 border border-rose-500/20 gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  <span>Remove Project</span>
                </Button>
              )}

              {isSuperAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => handleDeleteProject(e, activeDetailPageProject)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs rounded-xl h-8 border border-rose-500/20 gap-1.5"
                  title="Permanently Delete Project"
                >
                  <Trash2 className="size-3.5" />
                  <span className="hidden sm:inline">Delete Permanently</span>
                </Button>
              )}
            </div>
          </div>

          {/* Cancellation Alert Banner */}
          {activeDetailPageProject.status === "cancelled" && (
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/50 text-xs text-rose-200 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-extrabold text-rose-300 text-sm">
                  <AlertCircle className="size-4 text-rose-400" />
                  <span>🚫 Project Removed / Cancelled by Manager</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                  Saved in History
                </span>
              </div>
              <div className="text-xs text-rose-100 bg-black/40 p-3 rounded-xl border border-rose-500/30 leading-relaxed font-medium">
                <strong className="text-rose-300 block mb-1">Reason / Explanation (Vazahat):</strong>
                "{activeDetailPageProject.cancellation_reason || "Project was removed by department manager."}"
              </div>
              <div className="flex items-center justify-between text-[11px] text-rose-300/70 pt-1">
                <span>Removed By: <strong>{activeDetailPageProject.cancelled_by_name}</strong> ({activeDetailPageProject.cancelled_by_role || "Department Manager"})</span>
                <span>Date: {activeDetailPageProject.cancelled_at ? new Date(activeDetailPageProject.cancelled_at).toLocaleString() : ""}</span>
              </div>
            </div>
          )}

          {/* Revision History Banner */}
          {activeProjectRevisions.length > 0 && activeDetailPageProject.status !== "cancelled" && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <RotateCcw className="size-4 text-amber-400" />
                <span>Revision Requested (#{activeProjectRevisions.length})</span>
              </div>
              <p className="bg-black/30 p-2.5 rounded-xl border border-amber-500/20 text-amber-100/90 leading-relaxed font-medium">
                "{activeProjectRevisions[activeProjectRevisions.length - 1].issues_and_changes}"
              </p>
              <div className="text-[10px] text-amber-300/70">
                By: {activeProjectRevisions[activeProjectRevisions.length - 1].requested_by_name} • {new Date(activeProjectRevisions[activeProjectRevisions.length - 1].requested_at).toLocaleString()}
              </div>
            </div>
          )}

          {/* Main 2-Column Grid: Left (Details & Discussion) & Right (Metadata & History) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column (2 Cols wide) */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Project Title & Scope Card */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white/80 border border-white/10">
                      {activeDetailPageProject.target_department_name}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-600/20 text-violet-300 border border-violet-500/30">
                      {activeDetailPageProject.subcategory}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge(activeDetailPageProject.priority)}`}>
                      {activeDetailPageProject.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-2xl font-extrabold text-white break-words">
                    {activeDetailPageProject.title}
                  </h1>
                </div>

                {/* Scope & Description */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider">
                    Scope of Work & Deliverables
                  </h3>
                  <p className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed font-sans break-words">
                    {activeDetailPageProject.description || "No specific instructions provided."}
                  </p>
                </div>

                {/* External Links */}
                {activeDetailPageProject.attachments_links && (
                  <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-white/40 font-semibold">External Link / Assets:</span>
                    <a
                      href={activeDetailPageProject.attachments_links}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline flex items-center gap-1 truncate font-medium max-w-full"
                    >
                      <span className="truncate">{activeDetailPageProject.attachments_links}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  </div>
                )}
              </div>

              {/* Attached Files & Documents */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="size-4 text-violet-400 shrink-0" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Attached Files & Documents ({activeDetailPageProject.attached_files?.length || 0})
                    </h3>
                  </div>

                  {/* Upload More Files Button */}
                  <label className="cursor-pointer shrink-0">
                    <input
                      type="file"
                      multiple
                      disabled={uploadingExtraFile}
                      onChange={handleAttachExtraFilesToActiveProject}
                      className="hidden"
                    />
                    <span className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-bold transition-colors flex items-center gap-1.5">
                      {uploadingExtraFile ? <RefreshCw className="size-3 animate-spin" /> : <UploadCloud className="size-3.5" />}
                      <span>{uploadingExtraFile ? "Uploading..." : "+ Attach Files"}</span>
                    </span>
                  </label>
                </div>

                {activeDetailPageProject.attached_files && activeDetailPageProject.attached_files.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeDetailPageProject.attached_files.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        download={file.name}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-white/[0.08] transition-all text-xs group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="size-4 text-violet-400 shrink-0 group-hover:text-violet-300" />
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{file.name}</p>
                            {file.size ? (
                              <p className="text-[10px] text-white/40">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-violet-400 shrink-0 group-hover:translate-y-0.5 transition-transform">
                          <Download className="size-4" />
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/40 italic p-4 text-center bg-black/20 rounded-2xl border border-white/5">
                    No files attached yet. Click "+ Attach Files" above to upload documents or assets.
                  </p>
                )}
              </div>

              {/* ── INTERACTIVE COMMENTS DISCUSSION STREAM ─────────────────────── */}
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-violet-400 shrink-0" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Team Discussion & Revision Notes
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">
                    {activeDetailPageProject.comments?.length || 0} Comments
                  </span>
                </div>

                {/* Comment Stream List */}
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                  {(!activeDetailPageProject.comments || activeDetailPageProject.comments.length === 0) ? (
                    <p className="text-xs text-white/40 italic py-6 text-center bg-black/20 rounded-2xl border border-white/5">
                      No comments yet on this project. Write a note, instruction, or tag a team member below!
                    </p>
                  ) : (
                    activeDetailPageProject.comments.map((cmt) => {
                      const isMe = cmt.author_email?.toLowerCase().trim() === userEmail;
                      const isTaggingMe = isUserMentionedInComment(cmt, userEmail, userName);
                      return (
                        <div
                          key={cmt.id}
                          className={`p-3 rounded-2xl border text-xs space-y-1.5 transition-all ${
                            isTaggingMe
                              ? "bg-purple-950/30 border-purple-500/60 ring-1 ring-purple-500/40 shadow-sm"
                              : isMe
                              ? "bg-white/[0.04] border-white/15"
                              : "bg-white/[0.02] border-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 flex-wrap text-[11px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white">{cmt.author_name}</span>
                              {isMe && <span className="text-[10px] font-semibold text-white/50">(You)</span>}
                              <span className="text-[10px] text-white/40 hidden sm:inline">({cmt.author_email})</span>
                              {renderRoleBadge(cmt.author_role, cmt.author_email)}
                              {isTaggingMe && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-purple-600 text-white shadow-sm animate-pulse">
                                  🎯 Tagged You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-white/40">
                                {new Date(cmt.created_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingToModalComment(cmt);
                                  setCommentText((prev) =>
                                    prev.includes(`@${cmt.author_name}`) ? prev : `@${cmt.author_name} ${prev}`
                                  );
                                }}
                                className="flex items-center gap-1 text-[9px] text-violet-300 hover:text-white p-0.5 rounded"
                                title={`Reply to ${cmt.author_name}`}
                              >
                                <Reply className="size-2.5 text-violet-400" />
                                <span>Reply</span>
                              </button>
                              {canDeleteComment(activeDetailPageProject, cmt) && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteComment(e, activeDetailPageProject, cmt.id)}
                                  className="text-white/30 hover:text-rose-400 p-0.5 rounded transition-colors"
                                  title="Delete Comment"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {cmt.reply_to && (
                            <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-black/40 border-l-2 border-l-violet-500 border border-white/5 text-[10px] text-white/70">
                              <CornerUpLeft className="size-2.5 text-violet-400 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="font-bold text-violet-300">
                                  Replying to {cmt.reply_to.author_name}:
                                </span>
                                <span className="ml-1 text-white/60 truncate italic">"{cmt.reply_to.content_snippet}"</span>
                              </div>
                            </div>
                          )}

                          {renderCommentContent(cmt.content)}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Replying To Banner */}
                {replyingToModalComment && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-violet-950/40 border border-violet-500/40 text-xs animate-fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                      <CornerUpLeft className="size-3.5 text-violet-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-violet-300 font-semibold block">
                          Replying to {replyingToModalComment.author_name} ({replyingToModalComment.author_email})
                        </span>
                        <p className="text-[11px] text-white/70 truncate italic">
                          "{replyingToModalComment.content}"
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToModalComment(null)}
                      className="text-white/40 hover:text-white p-1"
                      title="Cancel Reply"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}

                {/* Comment Input Box */}
                <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-white/5">
                  <Textarea
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Post a comment or update... Type @ to tag a team member"
                    className="bg-black/40 border-white/10 text-white rounded-2xl text-xs resize-none"
                  />

                  {/* Quick Tag Chips */}
                  {registeredAgents.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-white/50">
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <AtSign className="size-3 text-violet-400" />
                        <span>Tag:</span>
                      </span>
                      {registeredAgents.map((ag) => (
                        <button
                          key={ag.email}
                          type="button"
                          onClick={() => {
                            setCommentText((prev) => (prev ? `${prev} @${ag.name} ` : `@${ag.name} `));
                          }}
                          className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-violet-600/20 hover:text-violet-300 border border-white/10 text-[10px] text-white/70 transition-colors"
                          title={ag.email}
                        >
                          @{ag.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-[10px] text-white/40 flex flex-wrap items-center gap-1">
                      <span>Posting as:</span>
                      <strong className="text-white/80">{userName}</strong>
                      {renderRoleBadge(isSuperAdmin ? "admin" : "working_agent", userEmail)}
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={!commentText.trim() || submittingComment}
                      className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl h-8 px-4 gap-1.5 shadow-sm ml-auto"
                    >
                      {submittingComment ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      <span>{submittingComment ? "Posting..." : "Send Comment"}</span>
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column (1 Col wide: Client info, Assigned Agent, Audit History) */}
            <div className="space-y-6">
              {/* Client / Business Details Card */}
              <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="size-4 text-violet-400" />
                  <span>Client & Deal Information</span>
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                    <span className="text-white/40">Brand / Company:</span>
                    <span className="font-bold text-white">{activeDetailPageProject.client_company || "—"}</span>
                  </div>

                  {activeDetailPageProject.client_phone && (
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                      <span className="text-white/40">Phone / Contact:</span>
                      <span className="font-bold text-white">{activeDetailPageProject.client_phone}</span>
                    </div>
                  )}

                  {activeDetailPageProject.client_email && (
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                      <span className="text-white/40">Email:</span>
                      <span className="font-bold text-white">{activeDetailPageProject.client_email}</span>
                    </div>
                  )}

                  {activeDetailPageProject.budget_or_value && (
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                      <span className="text-white/40">Budget / Value:</span>
                      <span className="font-bold text-emerald-400">{activeDetailPageProject.budget_or_value}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment & Creator Details */}
              <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="size-4 text-emerald-400" />
                  <span>Workflow & Team Allocation</span>
                </h3>

                <div className="space-y-3 text-xs">
                  {/* Currently Working Agent */}
                  <div className="p-3 rounded-2xl bg-black/30 border border-white/5 space-y-1.5">
                    <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider block">
                      Currently Working On Project
                    </span>
                    {activeDetailPageProject.claimed_by_email ? (
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div>
                          <p className="font-bold text-emerald-300">
                            {getResolvedAgentName(activeDetailPageProject.claimed_by_email, activeDetailPageProject.claimed_by_name)}
                          </p>
                          <p className="text-[10px] text-white/40">{activeDetailPageProject.claimed_by_email}</p>
                        </div>
                        {renderRoleBadge(activeDetailPageProject.claimed_by_role, activeDetailPageProject.claimed_by_email)}
                      </div>
                    ) : (
                      <p className="text-amber-400 font-semibold">Unclaimed / Open in Department Queue</p>
                    )}
                  </div>

                  {/* Latest Transfer Callout (if transferred) */}
                  {Array.isArray(activeDetailPageProject.transfer_history) && activeDetailPageProject.transfer_history.length > 0 && (
                    (() => {
                      const latestTransfer = activeDetailPageProject.transfer_history[activeDetailPageProject.transfer_history.length - 1];
                      return (
                        <div className="p-3 rounded-2xl bg-violet-950/30 border border-violet-500/30 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-violet-300 font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                              <ArrowLeftRight className="size-3 text-violet-400" />
                              <span>Latest Transfer Handoff</span>
                            </span>
                            <span className="text-white/40 font-mono font-normal">
                              {new Date(latestTransfer.transferred_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-xs text-white/90">
                            Transferred by <strong className="text-violet-300">{latestTransfer.from_agent_name}</strong> to <strong className="text-emerald-300">{latestTransfer.to_agent_name}</strong>
                          </p>
                          {latestTransfer.reason && (
                            <p className="text-[11px] text-white/60 bg-black/40 p-2 rounded-xl border border-white/5 italic">
                              "{latestTransfer.reason}"
                            </p>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {/* Originally Created By */}
                  <div className="p-3 rounded-2xl bg-black/30 border border-white/5 space-y-1.5">
                    <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider block">
                      Originally Created By
                    </span>
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div>
                        <p className="font-bold text-white/90">
                          {getResolvedAgentName(activeDetailPageProject.created_by_email, activeDetailPageProject.created_by_name)}
                        </p>
                        <p className="text-[10px] text-white/40">{activeDetailPageProject.created_by_email}</p>
                        {activeDetailPageProject.created_by_department && (
                          <span className="text-[10px] text-violet-300/80 font-medium block mt-0.5">
                            Dept: {activeDetailPageProject.created_by_department}
                          </span>
                        )}
                      </div>
                      {renderRoleBadge(activeDetailPageProject.created_by_role, activeDetailPageProject.created_by_email)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Trail & Revisions History */}
              {((activeProjectRevisions.length > 0) ||
                (Array.isArray(activeDetailPageProject.transfer_history) && activeDetailPageProject.transfer_history.length > 0)) && (
                <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="size-4 text-violet-400" />
                    <span>Project History & Audit Trail</span>
                  </h3>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin">
                    {/* Transfer History */}
                    {(activeDetailPageProject.transfer_history || []).map((tr, idx) => (
                      <div key={idx} className="p-3 rounded-2xl bg-black/40 border border-violet-500/20 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-violet-300 font-bold">
                          <span className="flex items-center gap-1">
                            <ArrowLeftRight className="size-3 text-violet-400" />
                            <span>Handoff / Transfer #{idx + 1}</span>
                          </span>
                          <span className="text-white/40 font-mono font-normal">
                            {new Date(tr.transferred_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-white/90">
                          From <strong className="text-white">{tr.from_agent_name}</strong> → To <strong className="text-emerald-300">{tr.to_agent_name}</strong>
                        </p>
                        {tr.reason && (
                          <p className="text-[11px] text-white/60 bg-white/[0.02] p-2 rounded-xl border border-white/5 italic">
                            "{tr.reason}"
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Revision History */}
                    {activeProjectRevisions.map((rev, idx) => (
                      <div key={rev.revision_id || idx} className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-amber-300 font-bold">
                          <span className="flex items-center gap-1">
                            <RotateCcw className="size-3 text-amber-400" />
                            <span>Revision Request #{idx + 1}</span>
                          </span>
                          <span className="text-amber-300/60 font-mono font-normal">
                            {new Date(rev.requested_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-amber-100/90 font-medium">"{rev.issues_and_changes}"</p>
                        <div className="text-[10px] text-amber-300/70">
                          Requested by: <strong className="text-amber-200">{rev.requested_by_name}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ACCESS RESTRICTED MODAL (REGULAR AGENTS ON CANCELLED/DELETED) ─── */}
      {accessRestrictedModalProject && (
        <div
          onClick={() => setAccessRestrictedModalProject(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-[#0d121f] p-6 shadow-2xl space-y-4 text-center"
          >
            <div className="size-14 rounded-2xl bg-rose-600/20 border border-rose-500/40 grid place-items-center text-rose-400 mx-auto shadow-lg">
              <Lock className="size-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Access Restricted</h3>
              <p className="text-xs text-white/70 mt-2 leading-relaxed">
                Project <strong>"{accessRestrictedModalProject.title}"</strong> has been removed/cancelled by the department manager.
              </p>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 mt-3 text-left">
                <p className="font-semibold text-rose-300">Security Policy:</p>
                <p className="text-[11px] text-rose-200/90 mt-1">
                  Working agents cannot view or edit removed/cancelled projects. Only Department Managers and Super Admins have permission to review removed records and history.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => setAccessRestrictedModalProject(null)}
                className="w-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl h-9"
              >
                Understood & Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE PROJECT MODAL ─────────────────────────────────────────── */}
      {createModalOpen && (
        <div
          onClick={() => setCreateModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0d121f] p-4 sm:p-6 shadow-2xl space-y-5 my-4 sm:my-8 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FolderKanban className="size-5 text-violet-400" />
                <h3 className="text-lg font-bold text-white">Create New Project & Assign Department</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-white/40 hover:text-white p-1 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
              {/* Project Title */}
              <div>
                <Label className="text-xs text-white/80 font-semibold">Project Title / Goal *</Label>
                <Input
                  required
                  value={newProject.title}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Modern E-commerce Website Rebrand & Design"
                  className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs h-10"
                />
              </div>

              {/* Department & Subcategory Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-white/80 font-semibold">Target Department *</Label>
                  <select
                    value={newProject.target_department_id}
                    onChange={(e) => {
                      const deptId = e.target.value;
                      const dept = departments.find((d) => d.id === deptId);
                      const sub = dept?.subcategories?.[0] || "General Task";
                      setNewProject((prev) => ({
                        ...prev,
                        target_department_id: deptId,
                        subcategory: sub,
                        direct_assignee_email: "",
                      }));
                    }}
                    style={{ colorScheme: "dark" }}
                    className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0b0f19] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#0b0f19] text-white">
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs text-white/80 font-semibold">Task Subcategory / Type *</Label>
                  <select
                    value={newProject.subcategory}
                    onChange={(e) => setNewProject((prev) => ({ ...prev, subcategory: e.target.value }))}
                    style={{ colorScheme: "dark" }}
                    className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0b0f19] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    {currentDeptSubcategories.map((sub) => (
                      <option key={sub} value={sub} className="bg-[#0b0f19] text-white">
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Direct Agent / Manager Assignment (Optional) */}
              <div>
                <Label className="text-xs text-white/80 font-semibold flex items-center justify-between">
                  <span>Direct Assignment to Agent / Manager (Optional)</span>
                  <span className="text-[10px] text-violet-400 font-normal">Auto-claims project on creation</span>
                </Label>
                {(() => {
                  const groups = getDeptAssigneeGroups(newProject.target_department_id);
                  return (
                    <div className="space-y-2 mt-1">
                      <select
                        value={newProject.direct_assignee_email || ""}
                        onChange={(e) => setNewProject((prev) => ({ ...prev, direct_assignee_email: e.target.value }))}
                        style={{ colorScheme: "dark" }}
                        className="w-full h-10 px-3 rounded-xl bg-[#0b0f19] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="" className="bg-[#0b0f19] text-white/70">
                          — Leave Unclaimed in Queue (Direct Department Pool) —
                        </option>
                        {groups.manager && (
                          <optgroup label="Department Manager" className="bg-[#0b0f19] text-purple-300 font-bold">
                            <option value={groups.manager.email} className="bg-[#0b0f19] text-white">
                              ⭐ {groups.manager.name} ({groups.manager.email}) — Department Manager
                            </option>
                          </optgroup>
                        )}
                        {groups.workingAgents.length > 0 && (
                          <optgroup label="Department Working Agents" className="bg-[#0b0f19] text-violet-300 font-bold">
                            {groups.workingAgents.map((a) => (
                              <option key={a.email} value={a.email} className="bg-[#0b0f19] text-white">
                                👤 {a.name} ({a.email}) {a.designation ? `— ${a.designation}` : ""}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {groups.admins.length > 0 && (
                          <optgroup label="Super Admins" className="bg-[#0b0f19] text-amber-300 font-bold">
                            {groups.admins.map((adm) => (
                              <option key={adm.email} value={adm.email} className="bg-[#0b0f19] text-white">
                                🛡️ {adm.name} ({adm.email}) — Admin
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {groups.isEcommerce && (
                        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] leading-relaxed animate-fade-in">
                          <ShoppingBag className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                          <span>
                            <strong>E-commerce Policy:</strong> Projects cannot be assigned directly to individual working agents. They will be placed directly in the E-commerce Department queue (so any agent can claim them) or assigned to the Department Manager.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Client Info & Priority Grid */}
              {newProject.target_department_id === "production-house" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-white/80 font-semibold">Client Company / Brand</Label>
                    <Input
                      value={newProject.client_company}
                      onChange={(e) => setNewProject((prev) => ({ ...prev, client_company: e.target.value }))}
                      placeholder="e.g. Acme Studios, Nike"
                      className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/80 font-semibold">Priority Level *</Label>
                    <select
                      value={newProject.priority}
                      onChange={(e) => setNewProject((prev) => ({ ...prev, priority: e.target.value as any }))}
                      style={{ colorScheme: "dark" }}
                      className="mt-1 w-full h-9 px-3 rounded-xl bg-[#0b0f19] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                    >
                      <option value="normal" className="bg-[#0b0f19] text-white">⚪ Normal Priority</option>
                      <option value="medium" className="bg-[#0b0f19] text-blue-300">🔵 Medium Priority</option>
                      <option value="high" className="bg-[#0b0f19] text-amber-300">🟠 High Priority</option>
                      <option value="urgent" className="bg-[#0b0f19] text-rose-300">🔴 Urgent (Immediate Action)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-white/80 font-semibold">Client Company / Brand</Label>
                      <Input
                        value={newProject.client_company}
                        onChange={(e) => setNewProject((prev) => ({ ...prev, client_company: e.target.value }))}
                        placeholder="e.g. Acme Studios"
                        className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/80 font-semibold">Client Phone / Contact</Label>
                      <Input
                        value={newProject.client_phone}
                        onChange={(e) => setNewProject((prev) => ({ ...prev, client_phone: e.target.value }))}
                        placeholder="+1 (555) 000-1234"
                        className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/80 font-semibold">Budget / Deal Value</Label>
                      <Input
                        value={newProject.budget_or_value}
                        onChange={(e) => setNewProject((prev) => ({ ...prev, budget_or_value: e.target.value }))}
                        placeholder="$2,500"
                        className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs h-9"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-white/80 font-semibold">Priority Level *</Label>
                    <select
                      value={newProject.priority}
                      onChange={(e) => setNewProject((prev) => ({ ...prev, priority: e.target.value as any }))}
                      className="mt-1 w-full h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                    >
                      <option value="normal">⚪ Normal Priority</option>
                      <option value="medium">🔵 Medium Priority</option>
                      <option value="high">🟠 High Priority</option>
                      <option value="urgent">🔴 Urgent (Immediate Action)</option>
                    </select>
                  </div>
                </>
              )}

              {/* Description / Instructions */}
              <div>
                <Label className="text-xs text-white/80 font-semibold">Detailed Instructions & Scope *</Label>
                <Textarea
                  rows={3}
                  value={newProject.description}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Specify all deliverables, design styles, tech stack, or customer requests..."
                  className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs"
                />
              </div>

              {/* Attachments / Drive Links */}
              <div>
                <Label className="text-xs text-white/80 font-semibold">Assets, Figma & Drive Links (Optional)</Label>
                <Input
                  value={newProject.attachments_links}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, attachments_links: e.target.value }))}
                  placeholder="https://drive.google.com/... or Figma link"
                  className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs h-9"
                />
              </div>

              {/* Computer File Upload / Attachments */}
              <div className="space-y-1.5">
                <Label className="text-xs text-white/80 font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="size-3.5 text-violet-400" />
                    <span>Attach Files / Upload from Computer</span>
                  </span>
                  <span className="text-[10px] text-white/40">Images, ZIP, PSD, AI, PDF, Video, Docs</span>
                </Label>

                <div className="flex flex-col gap-2">
                  <label className={`flex flex-col items-center justify-center p-3.5 rounded-xl border border-dashed transition-all cursor-pointer ${
                    uploadingFile
                      ? "bg-violet-950/30 border-violet-500/60 cursor-wait"
                      : "bg-black/40 border-white/15 hover:border-violet-500/50 hover:bg-white/[0.04]"
                  }`}>
                    <input
                      type="file"
                      multiple
                      disabled={uploadingFile}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {uploadingFile ? (
                      <div className="flex items-center gap-2 text-xs text-violet-300">
                        <RefreshCw className="size-4 animate-spin text-violet-400" />
                        <span className="font-semibold">Uploading attached file(s) to cloud storage...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-white/70">
                        <UploadCloud className="size-4 text-violet-400" />
                        <span>Click to browse or drop computer files here</span>
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] text-white/60 font-mono">Upload</span>
                      </div>
                    )}
                  </label>

                  {newProject.attached_files && newProject.attached_files.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {newProject.attached_files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="size-3.5 text-violet-400 shrink-0" />
                            <span className="truncate text-white/90 font-medium">{file.name}</span>
                            {file.size ? (
                              <span className="text-[10px] text-white/40 shrink-0">
                                ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setNewProject((prev) => ({
                                ...prev,
                                attached_files: prev.attached_files?.filter((_, i) => i !== idx),
                              }));
                            }}
                            className="text-rose-400 hover:text-rose-300 p-1 shrink-0"
                            title="Remove file"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateModalOpen(false)}
                  className="text-xs text-white/60 hover:text-white rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingProject || uploadingFile}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl px-5 disabled:opacity-50"
                >
                  {submittingProject ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="size-3.5 animate-spin" />
                      Creating Project...
                    </span>
                  ) : (
                    "Create & Assign Project"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MANAGE DEPARTMENTS MODAL (ADMIN & MANAGERS) ───────────────────── */}
      {deptModalOpen && (
        <div
          onClick={() => setDeptModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0d121f] p-4 sm:p-6 shadow-2xl space-y-6 my-4 sm:my-8 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-violet-400" />
                <h3 className="text-lg font-bold text-white">Department Builder & Agent Allocation</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeptModalOpen(false)}
                className="text-white/40 hover:text-white p-1 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Department List & Role Manager */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/60">
                Active Departments ({departments.length})
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {departments.map((d) => (
                  <div key={d.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="p-2 rounded-xl bg-violet-600/20 text-violet-300">
                          {React.createElement(getDeptIcon(d.icon), { className: "size-4" })}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">{d.name}</p>
                          <p className="text-[10px] text-white/40 truncate">{d.member_emails.length} Team Members</p>
                        </div>
                      </div>

                      {!["production-house", "ecommerce-department", "sales-department"].includes(d.id) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDepartment(d.id)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                          title="Delete Department"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Manager Allocation */}
                    <div>
                      <Label className="text-[10px] text-white/50 block mb-1 font-semibold text-purple-300">Department Manager</Label>
                      <select
                        value={d.manager_email || ""}
                        onChange={(e) => handleAssignManager(d.id, e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="">— Unassigned Manager —</option>
                        {getAvailableAgentsForDept(d.id).map((a) => (
                          <option key={a.email} value={a.email}>
                            {a.name} ({a.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Team Leader Allocation */}
                    <div>
                      <Label className="text-[10px] text-white/50 block mb-1 font-semibold text-amber-300">🌟 Department Team Leader</Label>
                      <select
                        value={d.team_leader_email || ""}
                        onChange={(e) => handleAssignTeamLeader(d.id, e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="">— Unassigned Team Leader —</option>
                        {getAvailableAgentsForDept(d.id).map((a) => (
                          <option key={a.email} value={a.email}>
                            {a.name} ({a.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Member Allocation Checklist */}
                    <div>
                      <Label className="text-[10px] text-white/50 block mb-1">Assigned Working Agents</Label>
                      <div className="max-h-28 overflow-y-auto space-y-1 p-1.5 rounded-xl bg-black/30 border border-white/5 scrollbar-thin">
                        {(() => {
                          const deptAvailable = getAvailableAgentsForDept(d.id);
                          if (deptAvailable.length === 0) {
                            return (
                              <div className="text-[11px] text-white/40 italic p-2 text-center">
                                No available agents
                              </div>
                            );
                          }
                          return deptAvailable.map((a) => {
                            const clean = a.email.toLowerCase().trim();
                            const isMember = d.member_emails.includes(clean);
                            const isDeptManager = d.manager_email && d.manager_email.toLowerCase().trim() === clean;
                            return (
                              <label
                                key={a.email}
                                className="flex items-center justify-between gap-2 p-1 rounded-lg hover:bg-white/5 cursor-pointer text-[11px]"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-white/80 truncate">{a.name}</span>
                                  {isDeptManager && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                      Manager
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isMember}
                                  onChange={() => handleToggleMember(d.id, a.email)}
                                  className="rounded border-white/20 bg-black text-violet-600 focus:ring-0 cursor-pointer"
                                />
                              </label>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create Custom Department Form */}
            <form onSubmit={handleAddDepartment} className="p-4 rounded-2xl bg-violet-950/20 border border-violet-500/30 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                <Plus className="size-3.5" />
                <span>Add New Custom Department</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-white/80">Department Name *</Label>
                  <Input
                    required
                    value={newDeptForm.name}
                    onChange={(e) => setNewDeptForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Quality Assurance / QA"
                    className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/80">Subcategories (comma separated)</Label>
                  <Input
                    value={newDeptForm.subcategoriesStr}
                    onChange={(e) => setNewDeptForm((prev) => ({ ...prev, subcategoriesStr: e.target.value }))}
                    placeholder="e.g. Bug Testing, Security Audit"
                    className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs h-9"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl px-4"
                >
                  Create Department
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TRANSFER PROJECT MODAL ───────────────────────────────────────── */}
      {transferModalProject && (
        <div
          onClick={() => setTransferModalProject(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0d121f] p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="size-5 text-violet-400" />
                <h3 className="text-base font-bold text-white">Transfer Project</h3>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalProject(null)}
                className="text-white/40 hover:text-white p-1"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3.5">
              <div>
                <Label className="text-xs text-white/80 font-semibold">Target Department *</Label>
                <select
                  value={transferForm.targetDepartmentId}
                  onChange={(e) => {
                    const nextDeptId = e.target.value;
                    setTransferForm((p) => ({
                      ...p,
                      targetDepartmentId: nextDeptId,
                      targetAgentEmail: "",
                    }));
                  }}
                  style={{ colorScheme: "dark" }}
                  className="mt-1 w-full h-9 px-3 rounded-xl bg-[#0b0f19] border border-white/10 text-xs text-white cursor-pointer"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#0b0f19] text-white">
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs text-white/80 font-semibold flex items-center justify-between">
                  <span>Assign to Specific Agent / Manager (Optional)</span>
                  <span className="text-[10px] text-violet-400 font-normal">Directly assigns to worker</span>
                </Label>
                {(() => {
                  const groups = getDeptAssigneeGroups(transferForm.targetDepartmentId);
                  return (
                    <div className="space-y-2 mt-1">
                      <select
                        value={transferForm.targetAgentEmail}
                        onChange={(e) => setTransferForm((p) => ({ ...p, targetAgentEmail: e.target.value }))}
                        style={{ colorScheme: "dark" }}
                        className="w-full h-9 px-3 rounded-xl bg-[#0b0f19] border border-white/10 text-xs text-white cursor-pointer"
                      >
                        <option value="" className="bg-[#0b0f19] text-white/70">
                          — Leave Unclaimed in Department Queue (Direct Pool) —
                        </option>
                        {groups.manager && (
                          <optgroup label="Department Manager" className="bg-[#0b0f19] text-purple-300 font-bold">
                            <option value={groups.manager.email} className="bg-[#0b0f19] text-white">
                              ⭐ {groups.manager.name} ({groups.manager.email}) — Department Manager
                            </option>
                          </optgroup>
                        )}
                        {groups.workingAgents.length > 0 && (
                          <optgroup label="Department Working Agents" className="bg-[#0b0f19] text-violet-300 font-bold">
                            {groups.workingAgents.map((a) => (
                              <option key={a.email} value={a.email} className="bg-[#0b0f19] text-white">
                                👤 {a.name} ({a.email}) {a.designation ? `— ${a.designation}` : ""}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {groups.admins.length > 0 && (
                          <optgroup label="Super Admins" className="bg-[#0b0f19] text-amber-300 font-bold">
                            {groups.admins.map((adm) => (
                              <option key={adm.email} value={adm.email} className="bg-[#0b0f19] text-white">
                                🛡️ {adm.name} ({adm.email}) — Admin
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {groups.isEcommerce && (
                        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] leading-relaxed animate-fade-in">
                          <ShoppingBag className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                          <span>
                            <strong>E-commerce Policy:</strong> Cannot transfer directly to individual working agents. Hand-off will be placed in the department queue or assigned to the Department Manager.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <Label className="text-xs text-white/80">Reason / Notes for Hand-off</Label>
                <Textarea
                  rows={2}
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Explain why this project is being re-allocated..."
                  className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTransferModalProject(null)}
                  className="text-xs text-white/60"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl"
                >
                  Confirm Transfer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MARK COMPLETED / DONE MODAL ───────────────────────────────────── */}
      {doneModalProject && (
        <div
          onClick={() => {
            setDoneModalProject(null);
            setDoneModalNotes("");
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl sm:rounded-3xl bg-[#111624] border border-emerald-500/30 p-4 sm:p-6 space-y-5 shadow-2xl animate-scale-in max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 grid place-items-center text-emerald-400">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Mark Project as Completed & Delivered</h3>
                  <p className="text-xs text-white/50 truncate max-w-[300px]">
                    Project: <strong className="text-emerald-300">"{doneModalProject.title}"</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDoneModalProject(null);
                  setDoneModalNotes("");
                }}
                className="size-8 rounded-xl bg-white/5 hover:bg-white/10 grid place-items-center text-white/60 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDoneSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-200/90 leading-relaxed">
                🎉 This project will be marked as <strong>Completed & Delivered</strong> and moved to the <strong>Completed Projects</strong> section for review.
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">Completion Deliverables / Delivery Notes (Optional)</Label>
                <Textarea
                  value={doneModalNotes}
                  onChange={(e) => setDoneModalNotes(e.target.value)}
                  placeholder="e.g. Completed banner design and exported assets. Figma link: https://figma.com/..."
                  className="h-24 bg-black/40 border-white/10 text-xs text-white rounded-xl focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDoneModalProject(null);
                    setDoneModalNotes("");
                  }}
                  className="text-white/60 hover:text-white text-xs rounded-xl h-9 px-4"
                >
                  Cancel (Do Nothing)
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl h-9 px-5 gap-1.5 shadow-lg shadow-emerald-600/20"
                >
                  <Check className="size-4" />
                  <span>Confirm Done & Deliver</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REDO / REVISION MODAL ─────────────────────────────────────────── */}
      {redoModalProject && (
        <div
          onClick={() => setRedoModalProject(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-amber-500/40 bg-[#0d121f] p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="size-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Request Redo / Revision: "{redoModalProject.title}"</h3>
              </div>
              <button
                type="button"
                onClick={() => setRedoModalProject(null)}
                className="text-white/40 hover:text-white p-1"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleRedoSubmit} className="space-y-3.5">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                Submitting this form will automatically move this project back to the <strong>Active queue</strong>, reassign it to <strong>{redoModalProject.claimed_by_name || "the working agent"}</strong>, and trigger a revision alert notice on their screen!
              </div>

              <div>
                <Label className="text-xs text-white/80 font-semibold">What issues were found & changes required? *</Label>
                <Textarea
                  required
                  rows={4}
                  value={redoForm.issuesAndChanges}
                  onChange={(e) => setRedoForm({ issuesAndChanges: e.target.value })}
                  placeholder="e.g. The logo colors in the graphic design do not match the brand guidelines. Please adjust the hex code to #6366f1 and export PNG/SVG..."
                  className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRedoModalProject(null)}
                  className="text-xs text-white/60"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl px-4"
                >
                  Send Revision Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CANCEL / REMOVE PROJECT MODAL (MANDATORY REASON / VAZAHAT) ──────── */}
      {cancelModalProject && (
        <div
          onClick={() => setCancelModalProject(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-rose-500/40 bg-[#0d121f] p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">
                  Remove / Cancel Project: "{cancelModalProject.title}"
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalProject(null)}
                className="text-white/40 hover:text-white p-1"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCancelProjectSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 leading-relaxed space-y-1">
                <p className="font-bold text-rose-300 flex items-center gap-1.5">
                  <Shield className="size-3.5" />
                  <span>Department Manager Authorization</span>
                </p>
                <p>
                  As the Manager of <strong>{cancelModalProject.created_by_department || "this department"}</strong>, you are removing this project. The project will <strong>not be deleted</strong>; it will be marked as <strong>Removed / Cancelled</strong> and saved permanently in CRM history along with your explanation.
                </p>
              </div>

              <div>
                <Label className="text-xs text-white/80 font-semibold">
                  Explanation / Reason for Removal (Vazahat) *
                </Label>
                <Textarea
                  required
                  rows={4}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Client cancelled the project / duplicate created / requirements changed..."
                  className="mt-1 bg-black/40 border-white/10 text-white rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCancelModalProject(null)}
                  className="text-xs text-white/60 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!cancelReason.trim()}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl px-4 shadow-md shadow-rose-600/30"
                >
                  Confirm Removal & Save Reason
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
