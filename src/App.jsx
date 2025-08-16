import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Info,
  School,
  Briefcase,
  Plus,
  Search,
  Filter,
  Clock,
  Trash2,
  Edit3,
  Check,
  X,
  CircleHelp,
  SortAsc,
  ListTodo,
} from "lucide-react";
import { ResponsiveContainer, ScatterChart, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Scatter, ReferenceLine, Legend, Label } from "recharts";

// ---- Utilidades ----
const LS_KEY = "planner.tasks.v1";

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const daysBetween = (a, b) => Math.floor((startOfDay(a) - startOfDay(b)) / (1000 * 60 * 60 * 24));

const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const fmtDateInput = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function computePriority(t) {
  // Urgencia por fecha
  const today = new Date();
  const due = t.dueDate ? new Date(t.dueDate) : null;
  let daysLeft = null;
  let urgency = 0;
  if (due) {
    daysLeft = daysBetween(due, today);
    if (daysLeft < 0) {
      // Atrasada
      urgency = 100;
    } else {
      // 0 días => 80 puntos, 1 día => 40, 2 => 26, etc.
      urgency = Math.round(80 * (1 / (daysLeft + 1)));
    }
  }
  // Importancia 1-5 => 4-20 puntos
  const importance = Number(t.importance || 3);
  const importanceScore = importance * 4;
  // Penalización si falta info
  const infoPenalty = t.infoComplete ? 0 : -15;
  // Bonus leve por tareas de trabajo/escuela (ajustable). Aquí neutro.
  const raw = Math.max(0, Math.min(100, urgency + importanceScore + infoPenalty));
  const label = raw >= 80 ? "Alta" : raw >= 50 ? "Media" : "Baja";
  return { score: raw, label, daysLeft };
}

function classNames(...c) {
  return c.filter(Boolean).join(" ");
}

// ---- Helpers para gráfico y recap ----
function buildChartData(tasks) {
  const pts = tasks
    .filter((t) => !t.done && t.dueDate)
    .map((t) => {
      const pr = computePriority(t);
      return {
        x: pr.daysLeft, // días hasta la fecha (negativo = atrasada)
        y: Number(t.importance || 3), // importancia 1-5
        z: Math.max(60, pr.score * 20), // tamaño en función del score
        name: t.title,
        category: t.category,
      };
    });
  return {
    escuela: pts.filter((p) => p.category === "escuela"),
    trabajo: pts.filter((p) => p.category === "trabajo"),
  };
}

function recommendToday(tasks, hoursAvailable = 4) {
  const cand = tasks
    .filter((t) => !t.done)
    .map((t) => ({ t, pr: computePriority(t) }));

  cand.sort((a, b) => {
    // 1) Atrasadas primero; 2) menor daysLeft; 3) mayor score
    const aOver = a.pr.daysLeft !== null && a.pr.daysLeft < 0;
    const bOver = b.pr.daysLeft !== null && b.pr.daysLeft < 0;
    if (aOver !== bOver) return aOver ? -1 : 1;
    const aDL = a.pr.daysLeft === null ? 9999 : a.pr.daysLeft;
    const bDL = b.pr.daysLeft === null ? 9999 : b.pr.daysLeft;
    if (aDL !== bDL) return aDL - bDL;
    return computePriority(b.t).score - computePriority(a.t).score;
  });

  const today = [];
  let used = 0;
  for (const { t } of cand) {
    const eff = Number(t.effort || 0);
    if (used + eff <= hoursAvailable || today.length === 0) {
      today.push(t);
      used += eff;
    }
  }
  const chosenIds = new Set(today.map((x) => x.id));
  const backup = cand.map((x) => x.t).filter((t) => !chosenIds.has(t.id));
  return { today, backup, used };
}

function toTextAgenda(plan, hours) {
  const lines = [];
  lines.push(`Recap de hoy — objetivo ${hours}h (sugerido ${plan.used.toFixed(1)}h)`);
  lines.push("\nTareas principales:");
  plan.today.forEach((t, i) => {
    const pr = computePriority(t);
    lines.push(`${i + 1}. ${t.title} — ${t.effort || 0}h — ${t.dueDate ? `vence en ${pr.daysLeft}d` : "sin fecha"} — prioridad ${pr.label} (${pr.score})`);
  });
  if (plan.backup.length) {
    lines.push("\nSi sobra tiempo:");
    plan.backup.slice(0, 5).forEach((t, i) => {
      const pr = computePriority(t);
      lines.push(`• ${t.title} — ${t.effort || 0}h — ${t.dueDate ? `en ${pr.daysLeft}d` : "sin fecha"}`);
    });
  }
  return lines.join("\n");
}

// ---- Datos de ejemplo (semilla) ----
const seedTasks = () => [
  {
    id: generateId(),
    title: "Examen de Estadística",
    description: "Capítulos 4-7, repasar ejercicios de regresión",
    category: "escuela",
    dueDate: fmtDateInput(new Date(Date.now() + 2 * 86400000)),
    importance: 5,
    effort: 4,
    infoComplete: true,
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: generateId(),
    title: "Informe mensual AXA",
    description: "Consolidar KPIs de riesgo y propuestas Q3",
    category: "trabajo",
    dueDate: fmtDateInput(new Date(Date.now() + 5 * 86400000)),
    importance: 4,
    effort: 6,
    infoComplete: false,
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: generateId(),
    title: "Proyecto React Portafolio",
    description: "Pulir animaciones y sección de proyectos",
    category: "trabajo",
    dueDate: fmtDateInput(new Date(Date.now() + 14 * 86400000)),
    importance: 3,
    effort: 10,
    infoComplete: true,
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ---- Componentes UI ----
const Badge = ({ children, color = "gray" }) => (
  <span
    className={classNames(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      color === "green" && "bg-green-100 text-green-700",
      color === "blue" && "bg-blue-100 text-blue-700",
      color === "red" && "bg-red-100 text-red-700",
      color === "amber" && "bg-amber-100 text-amber-700",
      color === "gray" && "bg-gray-100 text-gray-700"
    )}
  >
    {children}
  </span>
);

const Pill = ({ icon: Icon, label, color }) => (
  <div className="flex items-center gap-1 text-xs font-medium">
    <Icon className={classNames("h-3.5 w-3.5", color)} />
    <span>{label}</span>
  </div>
);

const ProgressBar = ({ value = 0 }) => (
  <div className="w-full h-2 rounded-full bg-gray-200">
    <div
      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

const StatCard = ({ icon: Icon, title, value, sub }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 text-gray-600">
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{title}</span>
    </div>
    <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
    {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
  </div>
);

const EmptyState = ({ onAdd }) => (
  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 p-10 text-center">
    <ListTodo className="h-10 w-10 text-gray-400" />
    <h3 className="mt-3 text-lg font-semibold">Sin tareas aún</h3>
    <p className="mt-1 max-w-md text-sm text-gray-500">
      Agrega tu primera tarea para empezar a priorizar. Te diremos si está
      atrasada, su prioridad y qué te falta para cumplirla.
    </p>
    <button
      onClick={onAdd}
      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
    >
      <Plus className="h-4 w-4" /> Nueva tarea
    </button>
  </div>
);

// ---- Formulario Modal ----
function TaskModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(
    initial || {
      title: "",
      description: "",
      category: "escuela",
      dueDate: "",
      importance: 3,
      effort: 1,
      infoComplete: false,
      done: false,
    }
  );

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  if (!open) return null;

  const priority = computePriority(form);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl bg-white p-4 sm:p-5 shadow-xl max-h-[92dvh] overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {initial?.id ? "Editar tarea" : "Nueva tarea"}
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-3 flex flex-col">
            <div className="space-y-4 overflow-y-auto max-h-[70dvh] sm:max-h-[60vh] pr-1">
            <div>
              <label className="text-sm font-medium">Título</label>
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Categoría</label>
                <select
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  <option value="escuela">Escuela</option>
                  <option value="trabajo">Trabajo</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Fecha límite</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                  value={form.dueDate}
                  onChange={(e) => set("dueDate", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Importancia (1-5)</label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.importance}
                  onChange={(e) => set("importance", Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <div className="mt-1 text-xs text-gray-500">{form.importance}</div>
              </div>

              <div>
                <label className="text-sm font-medium">Esfuerzo (hrs)</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.effort}
                  onChange={(e) => set("effort", Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.infoComplete}
                  onChange={(e) => set("infoComplete", e.target.checked)}
                />
                Ya cuento con toda la información
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.done}
                  onChange={(e) => set("done", e.target.checked)}
                />
                Marcar como completada
              </label>
            </div>

            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CircleHelp className="h-4 w-4" />
                Cómo calculamos la prioridad
              </div>
              <ul className="mt-2 ml-4 list-disc text-xs text-gray-600">
                <li>Urgencia por fecha (entre más próxima o atrasada, mayor prioridad).</li>
                <li>Importancia 1-5 (más importante, mayor prioridad).</li>
                <li>Penalización si falta información (-15 puntos).</li>
              </ul>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Badge color={priority.label === "Alta" ? "red" : priority.label === "Media" ? "amber" : "gray"}>
                  Prioridad {priority.label}
                </Badge>
                <span className="text-xs text-gray-500">Score {priority.score}/100</span>
              </div>
            </div>

            </div>
            <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-3 mt-3 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                <Check className="h-4 w-4" /> Guardar
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---- Modal Recap Diario ----
function RecapModal({ open, onClose, plan, hours, onToggleDone, onCopy }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl bg-white p-4 sm:p-5 shadow-xl max-h-[92dvh] overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recap de hoy</h3>
            <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Objetivo: <span className="font-medium text-gray-800">{hours}h</span> — Sugerido: <span className="font-medium text-gray-800">{plan.used.toFixed(1)}h</span>
          </div>

          <div className="mt-4 space-y-3 max-h-[55vh] overflow-auto pr-1">
            {plan.today.map((t) => {
              const pr = computePriority(t);
              const catColor = t.category === "escuela" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";
              return (
                <div key={t.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${catColor}`}>
                          {t.category === "escuela" ? "Escuela" : "Trabajo"}
                        </span>
                        <span className="text-xs text-gray-500">{t.effort || 0}h</span>
                      </div>
                      <div className="mt-0.5 truncate font-medium text-gray-900">{t.title}</div>
                      <div className="text-xs text-gray-500">{t.dueDate ? `${pr.daysLeft < 0 ? Math.abs(pr.daysLeft) + 'd atrasada' : pr.daysLeft === 0 ? 'Hoy' : 'en ' + pr.daysLeft + 'd'}` : 'Sin fecha'} · Prioridad {pr.label} ({pr.score})</div>
                    </div>
                    <button onClick={() => onToggleDone(t)} className="rounded-xl border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50">
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Hecha
                    </button>
                  </div>
                </div>
              );
            })}

            {plan.backup.length > 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 p-3">
                <div className="text-xs font-medium text-gray-700">Si sobra tiempo</div>
                <ul className="mt-1 list-disc pl-5 text-xs text-gray-600">
                  {plan.backup.slice(0, 5).map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onCopy} className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">Copiar texto</button>
            <button onClick={onClose} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Listo</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---- Tarjeta de Tarea ----
function TaskCard({ task, onToggleDone, onToggleInfo, onEdit, onDelete }) {
  const pr = computePriority(task);
  const daysLabel =
    pr.daysLeft === null
      ? "Sin fecha"
      : pr.daysLeft < 0
      ? `${Math.abs(pr.daysLeft)}d atrasada`
      : pr.daysLeft === 0
      ? "Hoy"
      : `${pr.daysLeft}d`; // en X días

  const catColor = task.category === "escuela" ? "text-green-600" : "text-blue-600";
  const badgeColor = task.category === "escuela" ? "green" : "blue";

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      className={classNames(
        "flex flex-col rounded-2xl border bg-white p-3 sm:p-4 shadow-sm",
        pr.daysLeft !== null && pr.daysLeft < 0 && !task.done ? "border-red-300" : "border-gray-100",
        task.done ? "opacity-70" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-base font-semibold text-gray-900">{task.title}</h4>
            <Badge color={badgeColor}>
              {task.category === "escuela" ? (
                <span className="inline-flex items-center gap-1"><School className="h-3.5 w-3.5" /> Escuela</span>
              ) : (
                <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Trabajo</span>
              )}
            </Badge>
          </div>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge color={pr.label === "Alta" ? "red" : pr.label === "Media" ? "amber" : "gray"}>P. {pr.label}</Badge>
          <span className="text-xs text-gray-500">{pr.score}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-gray-600">
        <Pill icon={Calendar} label={task.dueDate ? task.dueDate : "Sin fecha"} color="text-gray-500" />
        <Pill icon={Clock} label={daysLabel} color={pr.daysLeft < 0 && !task.done ? "text-red-600" : "text-gray-500"} />
        <Pill icon={Info} label={task.infoComplete ? "Info completa" : "Falta info"} color={task.infoComplete ? "text-emerald-600" : "text-amber-600"} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleDone(task)}
            className={classNames(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm",
              task.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 hover:bg-gray-50"
            )}
          >
            <CheckCircle2 className="h-4 w-4" /> {task.done ? "Completada" : "Marcar como hecha"}
          </button>

          <button
            onClick={() => onToggleInfo(task)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <Info className="h-4 w-4" /> {task.infoComplete ? "Quitar 'info completa'" : "Marcar 'info completa'"}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(task)}
            className="rounded-xl p-2 text-gray-600 hover:bg-gray-100"
            title="Editar"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(task)}
            className="rounded-xl p-2 text-red-600 hover:bg-red-50"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ---- App principal ----
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const [status, setStatus] = useState("todas");
  const [sort, setSort] = useState("prioridad");
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [hoursToday, setHoursToday] = useState(() => parseFloat(localStorage.getItem("planner.hoursToday") || "4"));
  const [openRecap, setOpenRecap] = useState(false);

  // Cargar/guardar en localStorage
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setTasks(parsed);
        return;
      } catch (e) {
        console.warn("LocalStorage corrupto, reseteando.");
      }
    }
    const seed = seedTasks();
    setTasks(seed);
    localStorage.setItem(LS_KEY, JSON.stringify(seed));
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("planner.hoursToday", String(hoursToday || 0));
  }, [hoursToday]);

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q)
      );
    }
    if (category !== "todas") list = list.filter((t) => t.category === category);
    if (status !== "todas") list = list.filter((t) => (status === "hechas" ? t.done : !t.done));

    // Ordenar
    list.sort((a, b) => {
      if (sort === "prioridad") return computePriority(b).score - computePriority(a).score;
      if (sort === "fecha") return (a.dueDate || "") < (b.dueDate || "") ? -1 : 1;
      if (sort === "recientes") return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
      if (sort === "az") return a.title.localeCompare(b.title);
      return 0;
    });
    return list;
  }, [tasks, query, category, status, sort]);

  // Métricas
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const progress = total ? Math.round((done / total) * 100) : 0;

    const today = new Date();
    const overdue = tasks.filter((t) => {
      if (!t.dueDate || t.done) return false;
      const d = new Date(t.dueDate);
      return daysBetween(d, today) < 0;
    }).length;

    const next7 = tasks.filter((t) => {
      if (!t.dueDate || t.done) return false;
      const d = new Date(t.dueDate);
      const dl = daysBetween(d, today);
      return dl >= 0 && dl <= 7;
    }).length;

    const infoRate = total
      ? Math.round((tasks.filter((t) => t.infoComplete).length / total) * 100)
      : 0;

    return { total, done, progress, overdue, next7, infoRate };
  }, [tasks]);

  const chart = useMemo(() => buildChartData(tasks), [tasks]);
  const deliverNow = useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.done) return false;
        const pr = computePriority(t);
        if (pr.daysLeft !== null && pr.daysLeft < 0) return true;
        if (pr.daysLeft !== null && pr.daysLeft <= 1 && pr.label === "Alta") return true;
        return false;
      })
      .sort((a, b) => computePriority(b).score - computePriority(a).score)
      .slice(0, 5);
  }, [tasks]);

  const todayPlan = useMemo(() => recommendToday(tasks, hoursToday || 0), [tasks, hoursToday]);

  // Acciones
  const addTask = () => {
    setEditing(null);
    setOpenModal(true);
  };

  const saveTask = (form) => {
    if (editing) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editing.id ? { ...editing, ...form, updatedAt: new Date().toISOString() } : t))
      );
    } else {
      const t = {
        ...form,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTasks((prev) => [t, ...prev]);
    }
    setOpenModal(false);
    setEditing(null);
  };

  const toggleDone = (task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: !t.done, updatedAt: new Date().toISOString() } : t))
    );
  };

  const toggleInfo = (task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, infoComplete: !t.infoComplete, updatedAt: new Date().toISOString() } : t))
    );
  };

  const editTask = (task) => {
    setEditing(task);
    setOpenModal(true);
  };

  const deleteTask = (task) => {
    if (confirm("¿Eliminar esta tarea?")) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
        {/* Encabezado */}
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Planificador Prioritario</h1>
            <p className="mt-1 text-sm text-gray-600">
              Organiza escuela <span className="text-green-600">(verde)</span> y trabajo
              <span className="text-blue-600"> (azul)</span>, detecta atrasos y prioriza automáticamente.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={addTask}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white shadow hover:bg-blue-700 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Nueva tarea
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={CheckCircle2} title="Progreso" value={`${stats.progress}%`} sub={`${stats.done}/${stats.total} completadas`} />
          <StatCard icon={AlertTriangle} title="Atrasadas" value={stats.overdue} sub="Pendientes con fecha vencida" />
          <StatCard icon={Calendar} title="Próx. 7 días" value={stats.next7} sub="Con fecha esta semana" />
          <StatCard icon={Info} title="Info completa" value={`${stats.infoRate}%`} sub="Con datos suficientes" />
        </section>
        <div className="mt-3"><ProgressBar value={stats.progress} /></div>

        {/* Mapa de prioridad (flujo) */}
        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700">
              <AlertTriangle className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Mapa de prioridad — Urgencia vs. Importancia</h3>
            </div>
            <div className="text-xs text-gray-500">Burbuja = score; Verde Escuela, Azul Trabajo</div>
          </div>
          <div className="mt-3 h-56 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Días" tickCount={7} tick={{ fontSize: 10 }}>
                  <Label value="Días hasta entrega (0=hoy)" offset={-10} position="insideBottom" />
                </XAxis>
                <YAxis type="number" dataKey="y" name="Importancia" domain={[1, 5]} tickCount={5} tick={{ fontSize: 10 }} />
                <ZAxis type="number" dataKey="z" range={[60, 1800]} />
                <ReferenceLine x={0} stroke="#ef4444" strokeDasharray="4 4" />
                <ReferenceLine y={4} stroke="#f59e0b" strokeDasharray="4 4" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(val, name, props) => {
                  if (name === 'y') return [val, 'Importancia'];
                  if (name === 'x') return [val, 'Días'];
                  return [Math.round((props.payload.z || 0) / 20), 'Score'];
                }}
                labelFormatter={(label) => `Día ${label}`} />
                <Legend />
                <Scatter name="Escuela" data={chart.escuela} fill="#16a34a" />
                <Scatter name="Trabajo" data={chart.trabajo} fill="#2563eb" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {deliverNow.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-700">Entregar ya (más críticas):</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {deliverNow.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Filtros */}
        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar tarea..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-transparent text-sm outline-none"
                >
                  <option value="todas">Todas</option>
                  <option value="escuela">Escuela</option>
                  <option value="trabajo">Trabajo</option>
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5">
                <CheckCircle2 className="h-4 w-4 text-gray-400" />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="bg-transparent text-sm outline-none"
                >
                  <option value="todas">Estado: todas</option>
                  <option value="pendientes">Pendientes</option>
                  <option value="hechas">Hechas</option>
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5">
                <SortAsc className="h-4 w-4 text-gray-400" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-transparent text-sm outline-none"
                >
                  <option value="prioridad">Ordenar: Prioridad</option>
                  <option value="fecha">Fecha más próxima</option>
                  <option value="recientes">Más recientes</option>
                  <option value="az">A-Z</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Lista de tareas */}
        {/* Acciones rápidas */}
        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-700">Configura tus horas disponibles para hoy y genera un recap automático.</div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                Horas hoy
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={hoursToday}
                  onChange={(e) => setHoursToday(parseFloat(e.target.value || "0"))}
                  className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                />
              </label>
              <button
                onClick={() => setOpenRecap(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <ListTodo className="h-4 w-4" /> Recap de hoy
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6">
          {filtered.length === 0 ? (
            <EmptyState onAdd={addTask} />
          ) : (
            <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onToggleDone={toggleDone}
                  onToggleInfo={toggleInfo}
                  onEdit={editTask}
                  onDelete={deleteTask}
                />
              ))}
            </motion.div>
          )}
        </section>

        <footer className="mt-10 text-center text-xs text-gray-400">
          Hecho con ❤ para priorizar lo importante.
        </footer>
      </div>

      <TaskModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
          setEditing(null);
        }}
        onSave={saveTask}
        initial={editing}
      />

      <RecapModal
        open={openRecap}
        onClose={() => setOpenRecap(false)}
        plan={todayPlan}
        hours={hoursToday}
        onToggleDone={toggleDone}
        onCopy={() => {
          const text = toTextAgenda(todayPlan, hoursToday || 0);
          navigator.clipboard?.writeText(text);
        }}
      />
    </div>
  );
}
