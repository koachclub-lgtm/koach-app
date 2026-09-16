# MIGRACIÓN KOACH APP → SUPABASE DESTINO (Brasil)

**Fecha:** 16 de Septiembre, 2026  
**Estado:** FASE A ✅ COMPLETADA | FASE B 🔴 BLOQUEADO | FASE F 🔴 BLOQUEADO

---

## ✅ YA HECHO (por Claude)

- [x] Actualizar credenciales en app.html (líneas 629-630)
- [x] Actualizar credenciales en coach.html (líneas 690-691)
- [x] Actualizar credenciales en index.html (líneas 1380-1381)
- [x] Push a GitHub (2 commits)
- [x] Vercel auto-deploy iniciado

**Credenciales actuales:**
```
DESTINO: siecbdatfgmqbpxqtvsl (São Paulo, Brasil)
ANON_KEY: sb_publishable_ffGsmagqocuP1n1jvKUVGw_hVzdojas
```

---

## 🔴 BLOQUEADOR 1: CREAR USUARIOS EN AUTH (Requiere Matías)

**Dónde:** Supabase Dashboard → siecbdatfgmqbpxqtvsl → Authentication → Users

**Crear 3 usuarios manuales:**

| Email | Password | Role |
|-------|----------|------|
| socio.test@koach.cl | socio1234 | socio |
| coach.test@koach.cl | coach1234 | coach |
| admin.test@koach.cl | admin1234 | admin |

**Instrucciones:**
1. Entra a Supabase Dashboard
2. Selecciona proyecto `koach-club-brasil` (siecbdatfgmqbpxqtvsl)
3. Ve a **Authentication** → **Users**
4. Click en **Add user** (arriba a la derecha)
5. Ingresa email + password, clic en **Create user**
6. Repite 3 veces (una para cada usuario)

---

## 🔴 BLOQUEADOR 2: SINCRONIZAR AUTH → PROFILES

**Dónde:** Supabase Dashboard → SQL Editor → Ejecutar script

**Script a copiar (ajusta UUIDs si es necesario):**

```sql
-- Sincronizar usuarios auth.users → profiles
INSERT INTO public.profiles (id, nombre, email, role, activo, estado)
SELECT 
  u.id, 
  SPLIT_PART(u.email, '.', 1), 
  u.email, 
  CASE 
    WHEN u.email LIKE 'socio%' THEN 'socio'
    WHEN u.email LIKE 'coach%' THEN 'coach'
    WHEN u.email LIKE 'admin%' THEN 'admin'
    ELSE 'socio'
  END,
  true,
  'activo'
FROM auth.users u
WHERE u.email LIKE '%.test@koach.cl'
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email, 
  activo = EXCLUDED.activo;
```

**Instrucciones:**
1. Ve a **SQL Editor**
2. Copia el script arriba
3. Pegalo y ejecuta
4. Verifica que dice "INSERT 0 3" (3 usuarios creados)

---

## 🔴 BLOQUEADOR 3: APLICAR RLS POLICIES

**Dónde:** Supabase Dashboard → SQL Editor → Ejecutar script

**Script:** `/mnt/user-data/outputs/RLS_POLICIES_DESIGN.sql` (o ve a GitHub)

**Qué hace:**
- Habilita Row Level Security en 12 tablas
- Crea 40+ policies para control de acceso por role
- socio: ve solo sus datos
- coach/admin: ven todos los datos

**Instrucciones:**
1. Abre el archivo RLS_POLICIES_DESIGN.sql
2. Copia TODO el contenido
3. Ve a Supabase → SQL Editor
4. Pegalo y ejecuta
5. Debería ejecutarse sin errores (puede tardar 10-30 segundos)

---

## ⏳ DESPUÉS QUE MATÍAS COMPLETE LOS 3 BLOQUEADORES

Claude continuará con:

1. **Verificar RPC:** Confirmar que `reordenar_sesiones` existe
2. **Cargar datos test:** Ejecutar SEED_DATA_TEST.sql
3. **Testing end-to-end:**
   - Socio: login → ejecutar sesión → guardar
   - Coach: login → validar sesión → ver reportes
   - Admin: verificar acceso a todo

---

## 📋 CHECKLIST PARA MATÍAS

- [ ] 1. Crear 3 usuarios en Auth Dashboard (socio/coach/admin test)
- [ ] 2. Ejecutar script de sincronización auth→profiles
- [ ] 3. Ejecutar RLS_POLICIES_DESIGN.sql (40+ policies)
- [ ] 4. Confirmar a Claude que completaste los 3 pasos

**Mensajea cuando termines:** "Bloqueadores 1-3 completados"

---

## 🔗 REFERENCIAS

**Repo GitHub:** https://github.com/koachclub-lgtm/koach-app  
**Deploy Vercel:** koach-app-three.vercel.app (auto-update en progreso)  
**Supabase DESTINO:** https://app.supabase.com/project/siecbdatfgmqbpxqtvsl

---

**Última actualización:** 16-SEP-2026 16:37 UTC
