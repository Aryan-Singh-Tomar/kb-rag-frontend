import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";

// ─── Config ────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

// ─── Auth Context ──────────────────────────────────────────────────
const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [tokens, setTokens] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("kb_tokens"));
      return saved || null;
    } catch {
      return null;
    }
  });

  const login = async (username, password) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (res.error) return res;
    sessionStorage.setItem("kb_tokens", JSON.stringify(res));
    setTokens(res);
    return res;
  };

  const logout = async () => {
    if (tokens?.refreshToken) {
      try {
        await apiFetch("/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      } catch {}
    }
    sessionStorage.removeItem("kb_tokens");
    setTokens(null);
  };

  const getAccessToken = () => tokens?.accessToken;

  return (
    <AuthContext.Provider
      value={{
        tokens,
        login,
        logout,
        getAccessToken,
        isAuthenticated: !!tokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Low-level fetch (no auth header by default) ───────────────────
async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  try {
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 204 || res.status === 202) return { ok: true };
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: true, status: res.status, ...(data || {}) };
    return data;
  } catch (err) {
    return { error: true, status: 0, message: err.message };
  }
}

// ─── Authed fetch hook ─────────────────────────────────────────────
function useApi() {
  const { getAccessToken, logout } = useAuth();
  const authedFetch = useCallback(
    async (path, opts = {}) => {
      const token = getAccessToken();
      const headers = {
        ...(opts.headers || {}),
        Authorization: `Bearer ${token}`,
      };
      const result = await apiFetch(path, { ...opts, headers });
      if (result?.status === 401) logout();
      return result;
    },
    [getAccessToken, logout],
  );
  return authedFetch;
}

// ─── Ingestion status badge colors ─────────────────────────────────
const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-300",
  PROCESSING: "bg-blue-100 text-blue-800 border-blue-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  FAILED: "bg-red-100 text-red-800 border-red-300",
};

// ─── Icons (inline SVG) ────────────────────────────────────────────
const Icons = {
  Doc: () => (
    <svg
      width="20"
      height="20"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  ),
  Chat: () => (
    <svg
      width="20"
      height="20"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
      />
    </svg>
  ),
  Plus: () => (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
  ),
  Search: () => (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  ),
  Logout: () => (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
      />
    </svg>
  ),
  Spinner: () => (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  ),
  ChevronLeft: () => (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5L8.25 12l7.5-7.5"
      />
    </svg>
  ),
  ChevronRight: () => (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 4.5l7.5 7.5-7.5 7.5"
      />
    </svg>
  ),
  Eye: () => (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
  Refresh: () => (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
      />
    </svg>
  ),
  Send: () => (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
      />
    </svg>
  ),
};

// ─── Field Error display ───────────────────────────────────────────
function FieldError({ errors, field }) {
  const err = errors?.find((e) => e.field === field);
  if (!err) return null;
  return <p className="mt-1 text-xs text-red-400 font-medium">{err.message}</p>;
}

function GeneralError({ error }) {
  if (!error) return null;
  const msg = error.fieldErrors?.length
    ? "Please fix the highlighted fields."
    : error.error || error.message || "Something went wrong";
  return (
    <div className="rounded-lg bg-red-950/60 border border-red-800/50 px-4 py-3 text-sm text-red-300 mb-4">
      {msg}
    </div>
  );
}

// ─── Login Page ────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await login(username, password);
    if (res?.error) setError(res);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
      {/* ambient glow */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-rose-600/8 rounded-full blur-3xl pointer-events-none" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
              <span className="text-indigo-400 text-lg font-bold">KB</span>
            </div>
            <h1 className="text-xl font-semibold text-white tracking-tight">
              Knowledge Base RAG
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Sign in to continue</p>
          </div>

          <GeneralError error={error} />

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                placeholder="Enter username"
                autoFocus
              />
              <FieldError errors={error?.fieldErrors} field="username" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                placeholder="Enter password"
              />
              <FieldError errors={error?.fieldErrors} field="password" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            {loading ? <Icons.Spinner /> : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Sidebar nav ───────────────────────────────────────────────────
function Sidebar({ page, setPage }) {
  const { logout } = useAuth();
  const navItems = [
    { id: "documents", label: "Documents", icon: Icons.Doc },
    { id: "create", label: "New Document", icon: Icons.Plus },
    { id: "chat", label: "Ask Question", icon: Icons.Chat },
    { id: "search", label: "Vector Search", icon: Icons.Search },
  ];

  return (
    <aside className="w-60 shrink-0 bg-white/[0.02] border-r border-white/[0.06] flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <span className="text-indigo-400 text-xs font-bold">KB</span>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">
            KB RAG
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/20"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <item.icon />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent"
        >
          <Icons.Logout />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Document List Page (paginated) ────────────────────────────────
function DocumentListPage({ onViewDetail }) {
  const api = useApi();
  const [docs, setDocs] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    number: 0,
    totalPages: 0,
    totalElements: 0,
    size: 10,
  });
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(
    async (pageNum = 0) => {
      setLoading(true);
      const res = await api(
        `/documents?page=${pageNum}&size=10&sort=createdAt,desc`,
      );
      if (!res?.error) {
        setDocs(res.content || []);
        setPageInfo({
          number: res.number,
          totalPages: res.totalPages,
          totalElements: res.totalElements,
          size: res.size,
        });
      }
      setLoading(false);
    },
    [api],
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Documents</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {pageInfo.totalElements} documents total
          </p>
        </div>
        <button
          onClick={() => fetchPage(pageInfo.number)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Icons.Refresh /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-zinc-500">
          <Icons.Spinner />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="text-lg mb-1">No documents yet</p>
          <p className="text-sm">Create your first document to get started.</p>
        </div>
      ) : (
        <>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs">
                      #{doc.id}
                    </td>
                    <td className="px-4 py-3 text-zinc-200 font-medium">
                      {doc.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-md border font-medium ${STATUS_STYLES[doc.ingestionStatus] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                      >
                        {doc.ingestionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {fmtDate(doc.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onViewDetail(doc.id)}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                        title="View detail"
                      >
                        <Icons.Eye />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-zinc-600">
              Page {pageInfo.number + 1} of {pageInfo.totalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => fetchPage(pageInfo.number - 1)}
                disabled={pageInfo.number === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Icons.ChevronLeft /> Prev
              </button>
              <button
                onClick={() => fetchPage(pageInfo.number + 1)}
                disabled={pageInfo.number + 1 >= pageInfo.totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next <Icons.ChevronRight />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Document Detail Modal ─────────────────────────────────────────
function DocumentDetailModal({ docId, onClose }) {
  const api = useApi();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reingestLoading, setReingestLoading] = useState(false);
  const [reingestMsg, setReingestMsg] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api(`/documents/${docId}`);
      if (!res?.error) setDoc(res);
      setLoading(false);
    })();
  }, [api, docId]);

  const handleReingest = async () => {
    setReingestLoading(true);
    setReingestMsg(null);
    const res = await api(`/documents/${docId}/ingest`, { method: "POST" });
    setReingestMsg(
      res?.error
        ? "Re-ingestion failed."
        : "Re-ingestion started (202 Accepted).",
    );
    setReingestLoading(false);
  };

  const fmtDate = (iso) =>
    iso
      ? new Date(iso).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111118] border border-white/[0.08] rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-white font-semibold">Document Detail</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Icons.Spinner />
            </div>
          ) : !doc ? (
            <p className="text-zinc-500 text-center py-12">
              Document not found.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-zinc-600 font-mono text-xs">
                  #{doc.id}
                </span>
                <span className="text-zinc-500 text-xs">
                  {fmtDate(doc.createdAt)}
                </span>
              </div>
              <h4 className="text-lg font-semibold text-white">{doc.title}</h4>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 max-h-80 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-sans leading-relaxed">
                  {doc.content}
                </pre>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleReingest}
                  disabled={reingestLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 disabled:opacity-50 transition-colors"
                >
                  {reingestLoading ? <Icons.Spinner /> : <Icons.Refresh />}{" "}
                  Re-ingest
                </button>
                {reingestMsg && (
                  <span className="text-xs text-zinc-400">{reingestMsg}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Document Page ──────────────────────────────────────────
function CreateDocumentPage({ onCreated }) {
  const api = useApi();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await api("/documents", {
      method: "POST",
      body: JSON.stringify({ title, content }),
    });
    if (res?.error) {
      setError(res);
    } else {
      setSuccess(res);
      setTitle("");
      setContent("");
      if (onCreated) onCreated();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-white mb-1">Create Document</h2>
      <p className="text-sm text-zinc-500 mb-6">
        Add a new document to your knowledge base. Ingestion will begin
        automatically.
      </p>

      <GeneralError error={error} />

      {success && (
        <div className="rounded-lg bg-emerald-950/50 border border-emerald-800/40 px-4 py-3 text-sm text-emerald-300 mb-4">
          Document <span className="font-semibold">"{success.title}"</span>{" "}
          created (ID #{success.id}). Status: {success.ingestionStatus}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
            Title{" "}
            <span className="text-zinc-600 normal-case">(max 200 chars)</span>
          </label>
          <input
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            placeholder="Document title"
          />
          <FieldError errors={error?.fieldErrors} field="title" />
          <p className="mt-1 text-xs text-zinc-600">{title.length}/200</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
            Content{" "}
            <span className="text-zinc-600 normal-case">
              (max 200,000 chars)
            </span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            maxLength={200000}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-y font-mono leading-relaxed"
            placeholder="Paste your document content here…"
          />
          <FieldError errors={error?.fieldErrors} field="content" />
          <p className="mt-1 text-xs text-zinc-600">
            {content.length.toLocaleString()}/200,000
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
        >
          {loading ? <Icons.Spinner /> : <Icons.Plus />}
          Create Document
        </button>
      </form>
    </div>
  );
}

// ─── Chat / Ask Question Page ──────────────────────────────────────
function ChatPage() {
  const api = useApi();
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);

    const payload = { question: question.trim() };
    if (topK && parseInt(topK) > 0) payload.topK = parseInt(topK);

    const userQ = question.trim();
    setQuestion("");

    const res = await api("/chat/ask", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res?.error) {
      setError(res);
    } else {
      setHistory((prev) => [
        ...prev,
        { question: userQ, answer: res.answer, sources: res.sources },
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl">
      <h2 className="text-xl font-semibold text-white mb-1">Ask a Question</h2>
      <p className="text-sm text-zinc-500 mb-5">
        Query your knowledge base using RAG-powered chat.
      </p>

      <GeneralError error={error} />

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[200px] max-h-[55vh] pr-1">
        {history.length === 0 && !loading && (
          <div className="text-center py-16 text-zinc-600">
            <Icons.Chat />
            <p className="mt-3 text-sm">
              Ask anything about your ingested documents.
            </p>
          </div>
        )}

        {history.map((entry, i) => (
          <div key={i} className="space-y-3">
            {/* User question */}
            <div className="flex justify-end">
              <div className="bg-indigo-600/20 border border-indigo-500/20 rounded-xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                <p className="text-sm text-indigo-200">{entry.question}</p>
              </div>
            </div>

            {/* AI answer */}
            <div className="flex justify-start">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl rounded-tl-sm px-4 py-3 max-w-[90%]">
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {entry.answer}
                </p>
                {entry.sources?.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
                    <p className="text-xs text-zinc-500 font-medium mb-1.5">
                      Sources
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.sources.map((src, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 text-xs bg-zinc-800/70 text-zinc-400 border border-zinc-700/50 rounded-md px-2 py-0.5"
                          title={src.preview || ""}
                        >
                          Doc {src.documentId} · Chunk {src.chunkIndex}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Icons.Spinner /> Thinking…
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleAsk}
        className="flex items-end gap-3 bg-white/[0.02] border border-white/[0.08] rounded-xl p-3"
      >
        <div className="flex-1">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk(e);
              }
            }}
            rows={2}
            className="w-full bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none resize-none"
            placeholder="Ask a question about your documents…"
          />
          <FieldError errors={error?.fieldErrors} field="question" />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={20}
            value={topK}
            onChange={(e) => setTopK(e.target.value)}
            className="w-16 bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40"
            placeholder="topK"
            title="Top K results (optional)"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors shrink-0"
          >
            <Icons.Send />
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Vector Search Page ────────────────────────────────────────────
function SearchPage() {
  const api = useApi();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    const res = await api("/search", {
      method: "POST",
      body: JSON.stringify({ query: query.trim() }),
    });
    if (res?.error) {
      setError(res);
    } else {
      setResults(res);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold text-white mb-1">Vector Search</h2>
      <p className="text-sm text-zinc-500 mb-5">
        Search similar document chunks via embedding similarity.
      </p>

      <GeneralError error={error} />

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          placeholder="Enter search query…"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          {loading ? <Icons.Spinner /> : <Icons.Search />}
          Search
        </button>
      </form>

      {results && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 font-medium">
            {results.length} result(s)
          </p>
          {results.length === 0 && (
            <p className="text-sm text-zinc-600 py-8 text-center">
              No similar chunks found.
            </p>
          )}
          {results.map((r, i) => (
            <div
              key={i}
              className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4"
            >
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {r.text}
              </p>
              {r.metadata && Object.keys(r.metadata).length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex flex-wrap gap-2">
                  {Object.entries(r.metadata).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-xs bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 rounded px-1.5 py-0.5"
                    >
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────
function Dashboard() {
  const [page, setPage] = useState("documents");
  const [detailId, setDetailId] = useState(null);

  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-zinc-200">
      <Sidebar page={page} setPage={setPage} />

      <main className="flex-1 p-8 overflow-y-auto">
        {page === "documents" && (
          <DocumentListPage onViewDetail={(id) => setDetailId(id)} />
        )}
        {page === "create" && (
          <CreateDocumentPage onCreated={() => setPage("documents")} />
        )}
        {page === "chat" && <ChatPage />}
        {page === "search" && <SearchPage />}
      </main>

      {detailId !== null && (
        <DocumentDetailModal
          docId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

function AppRouter() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Dashboard /> : <LoginPage />;
}
