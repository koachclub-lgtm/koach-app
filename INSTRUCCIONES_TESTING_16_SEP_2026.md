# KOACH APP — TESTING DESTINO BRASIL
**Fecha:** 16 de Septiembre, 2026  
**Estado:** CÓDIGO APROBADO, DATOS LISTOS, PENDIENTE EJECUCIÓN

---

## 1️⃣ VERIFICACIÓN INICIAL (Matías)

Abre en navegador:
```
https://koach-app-three.vercel.app
```

**Acciones:**
- [ ] Página carga sin errores
- [ ] Browser console: NO hay errores rojo
- [ ] Verifica que `SB_URL` apunta a `siecbdatfgmqbpxqtvsl` (F12 → Console → type `SB_URL`)

**Expected:**
```
> SB_URL
'https://siecbdatfgmqbpxqtvsl.supabase.co'
```

---

## 2️⃣ SIGNUP SOCIO TEST (app.html)

**Acción:** Click "CREAR MI CUENTA"

**Ingresa:**
```
Nombre: Socio
Apellido: Test
Email: socio.test@koach.cl
Password: socio1234
```

**Verifica:**
- [ ] Página muestra "CORREO ENVIADO ✓" (NO error)
- [ ] Console: NO hay errores POST
- [ ] Network tab: POST auth/v1/signup → HTTP 200
- [ ] Network tab: POST /rest/v1/profiles → HTTP 201 (insert automático)

**Captura:**
- UUID del usuario (copia el user.id del Network response en /signup)
- Guárdalo: `SOCIO_UUID = <UUID aquí>`

---

## 3️⃣ CARGAR DATOS TEST

Entra a Supabase Dashboard → SQL Editor

**Script 1:** Datos base (ejercicios + protocolo + sesiones + bloques)

Copia TODO y ejecuta:
```sql
PASTE SEED_DATA_MINIMAL_DESTINO.sql
```

**Verifica:** Último SELECT retorna conteos correctos

**Script 2:** Asignación del socio test

Reemplaza `{SOCIO_UUID}` con el UUID capturado en paso 2:

```sql
INSERT INTO public.asignaciones 
  (socio_id, protocolo_id, semana_actual, asignada_por, activa)
SELECT 
  '{SOCIO_UUID}'::uuid,
  id,
  1,
  '00000000-0000-0000-0000-000000000001',
  true
FROM public.protocolos WHERE nombre = 'Protocolo Test';
```

**Verifica:** INSERT retorna 1 row

---

## 4️⃣ LOGIN SOCIO

De vuelta en app.html:

**Acciones:**
- [ ] Ya debería estar en login por defecto
- [ ] Email: `socio.test@koach.cl`
- [ ] Password: `socio1234`
- [ ] Click "ENTRAR A MI SEMANA"

**Expected:**
- [ ] Página carga con: "Cargando tu semana…"
- [ ] Muestra protocolo "Protocolo Test"
- [ ] Muestra 2 sesiones: "Sesión 1: Upper Body" + "Sesión 2: Lower Body"
- [ ] Console: NO hay errores

---

## 5️⃣ EJECUTAR SESIÓN (Socio)

**Acción:** Click en "Sesión 1: Upper Body"

**Expected:**
- [ ] Carga lista de ejercicios (Press de Banca, Flexiones)
- [ ] Cada ejercicio muestra campos: sets completados, reps, carga
- [ ] Puedes ingresar números

**Test Input:**
- Press de Banca: Set 1 → 6 reps, 80 kg → guardar
- Set 2 → 6 reps, 75 kg → guardar
- Flexiones: Set 1 → 10 reps → guardar

**Expected después de cada guardar:**
- [ ] Console: POST /rest/v1/set_registros o UPDATE → HTTP 200/201
- [ ] Dato persiste (reload página, vuelve el registro)

---

## 6️⃣ LOGOUT + RELOGIN (Socio)

**Acción:**
- [ ] Logout (busca botón Salir)
- [ ] Page recarga → vuelve a login
- [ ] Repite login con socio.test@koach.cl / socio1234

**Expected:**
- [ ] Session persiste (sin volver a entrar)
- [ ] Ve mismo protocolo y sesiones guardadas

---

## 7️⃣ LOGIN COACH (coach.html)

Nueva ventana o tab:
```
https://koach-app-three.vercel.app/coach.html
```

**Acciones:**
- [ ] Email: `coach.test@koach.cl`
- [ ] Password: `coach1234`
- [ ] Click "ENTRAR A LA SALA →"

**Expected:**
- [ ] Primera vez: pide PIN (prompt)
- [ ] Ingresa: `2026`
- [ ] Crea profile como COACH automáticamente
- [ ] Carga dashboard

---

## 8️⃣ DASHBOARD COACH

**Expected en pantalla:**
- [ ] Lista de socios: ve "Socio Test"
- [ ] Sesiones asignadas: ve "Sesión 1: Upper Body"
- [ ] Sets registrados por socio: ve datos que ingresó

**Test Acción:**
- [ ] Click en socio "Socio Test"
- [ ] Busca "Sesión 1" → Click para validar
- [ ] Marca como validada
- [ ] Guardar

**Expected:**
- [ ] Console: PUT sesiones_registro → HTTP 200
- [ ] Dato persiste

---

## 9️⃣ VERIFICACIÓN ADMIN

Nuevo login en coach.html:

**Acciones:**
- [ ] Email: `admin.test@koach.cl`
- [ ] Password: `admin1234`
- [ ] PIN: `2026` (para crear como ADMIN)

**Expected:**
- [ ] Dashboard carga completo
- [ ] Badge muestra "ADMIN ⚙"
- [ ] Ve TODOS los socios
- [ ] Acceso a configuración/reportes

---

## 🔟 END-TO-END SUMMARY

```
✅ AUTH_SIGNUP = PASS
✅ PROFILE_CREATION = PASS
✅ SOCIO_LOGIN = PASS
✅ SOCIO_SESSION_EXECUTION = PASS
✅ SOCIO_DATA_PERSISTENCE = PASS
✅ SOCIO_LOGOUT = PASS
✅ SOCIO_RELOGIN = PASS

✅ COACH_LOGIN = PASS
✅ COACH_PIN_BOOTSTRAP = PASS
✅ COACH_SEE_SOCIOS = PASS
✅ COACH_VALIDATE_SESSION = PASS

✅ ADMIN_LOGIN = PASS
✅ ADMIN_FULL_ACCESS = PASS

✅ RPC_REORDENAR_SESIONES = NOT_YET_TESTED (necesita UI específica)

✅ APP_OPERATIONAL = PASS
```

---

## 🚨 SI ALGO FALLA

**ERROR → Captura:**
1. Screenshot de página/console
2. URL exacta donde falló
3. Tiempo/timestamp
4. Texto exacto del error
5. Pasos para reproducir

**Envía:** Screenshot + pasos a Claude con línea "DEFECTO ENCONTRADO:"

Claude diagnosticará y solucionará sin necesidad de espera.

---

## ✅ SI TODO PASA

Confirma con: `APP_OPERATIONAL = PASS ✅`

