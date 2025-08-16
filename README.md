# Planificador Prioritario (React + Vite + Tailwind)

Un planificador de tareas con **priorización automática**, **mapa visual (urgencia vs. importancia)** y **recap diario** según tus horas disponibles.

## 🚀 Requisitos
- Node.js 18 o superior (recomendado 18/20)
- npm (incluido con Node)

## ▶️ Cómo correr en local
```bash
# 1) Instala dependencias
npm install

# 2) Ejecuta en modo desarrollo
npm run dev

# 3) Abre el enlace que aparece en consola (ej. http://localhost:5173)
```

## 🧱 Stack
- React + Vite
- Tailwind CSS (con plugin de line-clamp)
- Framer Motion (animaciones)
- Recharts (gráfico de burbujas)
- Lucide React (iconos)

## 🗂 Estructura
```
.
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── src
    ├── App.jsx        # Lógica, UI y gráfico
    ├── index.css      # Tailwind
    └── main.jsx       # Bootstrap de React
```

## 💾 Persistencia
- Se guarda en `localStorage` del navegador (clave: `planner.tasks.v1`).
- Las horas objetivo del día se guardan en `planner.hoursToday`.

## ✨ Funciones clave
- **Prioridad** = urgencia por fecha + importancia (1-5) − penalización si falta info.
- **Mapa de prioridad**: eje X = días hasta fecha (izquierda = atrasadas), eje Y = importancia; tamaño = score.
- **Entregar ya**: lista de tareas más críticas.
- **Recap de hoy**: sugiere qué hacer con tus horas disponibles y permite copiar el plan.

## ☁️ Despliegue en la nube (opcional)
### Vercel
1. Crea una cuenta en Vercel y conecta tu repo (o sube el zip).
2. Configuración automática para proyectos Vite.
3. En *Build Command*: `npm run build` y en *Output directory*: `dist/`.

### Netlify
1. Netlify → *New site from Git* (o arrastra la carpeta `dist` con *Deploys*).
2. *Build command*: `npm run build` y *Publish directory*: `dist/`.

## 🐛 Notas
Si ves un error de **cadena sin terminar**, verifica que en `App.jsx` la función `toTextAgenda(...)` use `\n` dentro de las comillas, tal como en este repo.

---
Hecho con ❤. Cualquier mejora que quieras (notificaciones diarias, calendario, Supabase para sync multi-dispositivo) me dices y lo añadimos.
