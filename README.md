# ניהול פלוגה — Pluga Operations

מערכת ניהול מבצעית לפלוגת שריון במילואים: כוח אדם, שמ"פ (שירות מילואים פעיל), שיבוץ צוותים לרכבים, ציוד, שגרה, הדרכה, תרומות ודוחות יומיים — הכל בעברית, RTL, ומותאם למובייל כ-PWA.

האפליקציה היא **client-only**: React SPA שמדבר ישירות מול Firebase (Firestore + Auth + Storage). אין שרת אפליקציה משלנו, אין API layer, ואין job-ים ברקע.

---

## תוכן עניינים

1. [סטאק טכנולוגי](#סטאק-טכנולוגי)
2. [התקנה והרצה](#התקנה-והרצה)
3. [משתני סביבה](#משתני-סביבה)
4. [מבנה הפרויקט](#מבנה-הפרויקט)
5. [מודל הנתונים](#מודל-הנתונים)
6. [קשרים בין ישויות](#קשרים-בין-ישויות)
7. [לוגיקה עסקית מרכזית](#לוגיקה-עסקית-מרכזית)
8. [מסכים ופונקציונליות](#מסכים-ופונקציונליות)
9. [מודל ההרשאות](#מודל-ההרשאות)
10. [דוחות וייצוא](#דוחות-וייצוא)
11. [גיבוי, ייבוא ומיגרציות](#גיבוי-ייבוא-ומיגרציות)
12. [עבודה במצב לא-מקוון (PWA)](#עבודה-במצב-לא-מקוון-pwa)
13. [אבטחה](#אבטחה)
14. [פריסה](#פריסה)
15. [חוב טכני ונקודות פתוחות](#חוב-טכני-ונקודות-פתוחות)

---

## סטאק טכנולוגי

| רכיב | טכנולוגיה |
|---|---|
| Build | Vite 6 |
| שפה | TypeScript 5.7 (strict) |
| UI | React 19 |
| ניתוב | react-router 7 (`BrowserRouter`) |
| עיצוב | Tailwind CSS 4 (`@tailwindcss/vite`) + רכיבי Radix UI בסגנון shadcn |
| אייקונים | lucide-react |
| State גלובלי | Zustand 5 + `persist` (localStorage) |
| טפסים ולידציה | react-hook-form + zod |
| DB / Auth / Storage | Firebase 12 (Firestore, Auth עם Google, Cloud Storage) |
| PWA | vite-plugin-pwa (Workbox, `autoUpdate`) |
| פריסה | Render (static site) |

**alias:** `@/` → `src/` (מוגדר ב-`vite.config.ts` וב-`tsconfig.app.json`).

---

## התקנה והרצה

```bash
npm install
```

```bash
npm run dev
```

הרצה בפורט 5201 (ראה `.claude/launch.json`). בנייה:

```bash
npm run build
```

בדיקת אבטחה סטטית:

```bash
npm run security-check
```

---

## משתני סביבה

כל המשתנים בתחילית `VITE_` ולכן נצרבים לתוך ה-bundle. הקובץ `src/firebase.ts` מכיל **fallback** לערכי הפרויקט `pluga-ops` כך שהאפליקציה עובדת גם בלי `.env`.

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

> קונפיג ה-web של Firebase הוא ציבורי מעצם הגדרתו — האבטחה האמיתית נאכפת ב-`firestore.rules` וב-`storage.rules`.

`VITE_GOOGLE_CLIENT_ID` מופיע ב-`.env.example` וב-`render.yaml` אך אינו בשימוש בקוד הנוכחי (ההתחברות עוברת דרך Firebase Auth).

---

## מבנה הפרויקט

```
src/
├── App.tsx                  # טבלת הניתוב, כל route עטוף ב-ProtectedRoute
├── main.tsx                 # root + AuthProvider
├── firebase.ts              # אתחול Firebase + persistence מרובה-טאבים
├── index.css                # design tokens (@theme) + light theme + utilities
│
├── db/
│   ├── schema.ts            # כל ה-types וה-interfaces של הישויות — מקור האמת
│   ├── backup.ts            # ייצוא/ייבוא JSON מלא
│   ├── import-legacy.ts     # ייבוא CSV מהמערכת הקודמת
│   ├── migrate-sizes.ts     # מיגרציית מידות מקובץ CSV ישן
│   └── seed.ts              # נתוני ברירת מחדל (סוגי ציוד, מחלקות) — לא נקרא כרגע
│
├── hooks/                   # שכבת גישה לנתונים "ליבתית"
│   ├── useSoldiers.ts       ├── useEquipment.ts    ├── useTanks.ts
│   ├── useStatusHistory.ts  ├── useShampaf.ts      ├── useAssignment.ts
│   ├── useActivation.ts     └── useOnlineStatus.ts
│
├── features/                # מודולים עצמאיים (hook + עמוד + רכיבים)
│   ├── routine/             ├── officer-tasks/     ├── training/
│   ├── donations/           └── permissions/
│
├── pages/                   # עמודים "ליבתיים"
├── components/
│   ├── layout/  auth/  ui/  gantt/  assignment/  shampaf/  soldiers/  tanks/  reports/
└── lib/
    ├── constants.ts         # enums → תוויות בעברית, צבעים, סדר תפקידים, רשימת routes
    ├── validators.ts        # סכמות zod לכל הטפסים
    ├── check-permission.ts  # בדיקת הרשאה לא-hook לשימוש בתוך mutations
    ├── report-generators.ts # 4 מחוללי דוחות טקסטואליים
    ├── export-utils.ts      # CSV עם BOM + העתקה ללוח כ-TSV
    ├── storage.ts           # העלאת קבצים ל-Cloud Storage עם ולידציה
    └── utils.ts             # cn, generateId, פורמט תאריכים, dateRangesOverlap, stripUndefined
```

### דפוס העבודה עם הנתונים

אין data layer מופשט. כל hook מבצע `onSnapshot` על collection שלם (או query פשוט עם `where`), ומסנן/ממיין **בזיכרון בצד הלקוח**. כל mutation היא פונקציה `async` מיוצאת מאותו קובץ hook, בתבנית קבועה:

```ts
export async function addX(data) {
  await requireEditPermission('/route');       // 1. בדיקת הרשאה
  const id = generateId();                     // 2. crypto.randomUUID()
  await setDoc(doc(db, 'collection', id),
    stripUndefined({ ...data, id }));          // 3. Firestore דוחה undefined
  return id;
}
```

מזהה המסמך ב-Firestore זהה תמיד לשדה `id` שבתוך המסמך.

---

## מודל הנתונים

Firestore, 23 collections. כל התאריכים הם מחרוזות ISO — `YYYY-MM-DD` לתאריך בלבד, `YYYY-MM-DDTHH:mm` לתאריך+שעה. ההשוואות מתבצעות לקסיקוגרפית על המחרוזות.

### כוח אדם

| Collection | תיאור | שדות עיקריים |
|---|---|---|
| `soldiers` | חייל | `firstName`, `lastName`, `militaryId`, `rank`, טלפונים, `bloodType`, `medicalNotes`, מידות (`personalItems` — מדי ב', סרבלים, תחתונים, נעליים, סיגריות), `platoonId`, `squadId`, `trainedRole`, `createdAt/updatedAt` |
| `statusEntries` | היסטוריית סטטוס אדמיניסטרטיבי | `soldierId`, `status`, `startDate`, `endDate?`, `orderNumber`, `notes` |
| `platoons` | מחלקות ארגוניות | `name`, `number`, `commanderId?` |
| `squads` | כיתות | `platoonId`, `name`, `number`, `leaderId?` — **מוגדר בסכמה, ללא UI** |

`SoldierStatus`: `active | reserve_ready | training | leave | medical_leave | preparation | released | absent | other`
`CrewRole`: `commander | gunner | driver | loader`
סדר תצוגה קבוע: מפקד → תותחן → טען → נהג (`ROLE_DISPLAY_ORDER`).

### ציוד

| Collection | תיאור | שדות עיקריים |
|---|---|---|
| `equipmentTypes` | קטלוג פריטים | `name`, `nameHe`, `category`, `serialNumberRequired`, `description` |
| `equipmentAssignments` | חתימת ציוד | `soldierId`, `equipmentTypeId`, `serialNumber`, `signedOutDate`, `signedInDate?`, `condition`, `notes` |

חתימה פעילה = רשומה ללא `signedInDate`.

### רכבים ושיבוץ מבצעי

| Collection | תיאור | שדות עיקריים |
|---|---|---|
| `tanks` | רכב (טנק או רכב רגיל) | `designation`, `type`, `vehicleCategory`, `status`, `platoonId?`, `departmentId?`, `notes` |
| `departments` | מחלקה לקיבוץ רכבים בשיבוץ | `name`, `order` |
| `tankCrewAssignments` | צוות קבוע לרכב | `tankId`, `soldierId`, `role`, `startDate`, `endDate?` — **מדור קודם, ראה הערה למטה** |
| `activations` | הפעלה / תקופת פעילות | `name`, `startDate`, `endDate`, `notes` |
| `shampafEntries` | תקופת שמ"פ של חייל | `soldierId`, `startDateTime`, `endDateTime`, `orderNumber`, `notes` |
| `shampafVacations` | חופשה/התארגנות בתוך שמ"פ | `shampafEntryId`, `soldierId`, `type` (`vacation`\|`preparation`), `startDateTime`, `endDateTime`, `reason`, `notes` |
| `assignments` | שיבוץ מבצעי בזמן | `soldierId`, `type` (`tank_role`\|`general_mission`), `tankId?`, `role?`, `missionName?`, `startDateTime`, `endDateTime`, `notes` |

### שגרה (עולם נפרד ומקביל)

| Collection | תיאור | שדות עיקריים |
|---|---|---|
| `routineDepartments` | מחלקות שגרה | `name`, `order` |
| `routineVehicles` | רכבי שגרה | `designation`, `vehicleCategory`, `departmentId?` |
| `routineTemplates` | תבנית צוות קבוע לרכב שגרה | `name`, `tankId`, `crewSlots[]` (`{role, soldierId}`), `notes`, `createdAt/updatedAt` |
| `routineChangeLogs` | יומן שינויים append-only | `templateId`, `action` (`create`\|`delete`\|`assign`\|`unassign`), `role?`, `soldierId?`, `soldierName?`, `changedBy`, `changedByName`, `timestamp` |

> ⚠️ **נקודה קריטית**: `RoutineTemplate.tankId` מצביע ל-`routineVehicles`, **לא** ל-`tanks`. עולם השגרה מנותק לחלוטין מעולם השיבוץ המבצעי, למרות שם השדה. שתי המערכות חולקות רק את `soldiers`.

### תוכן ותרומות

| Collection | תיאור | שדות עיקריים |
|---|---|---|
| `trainingContent` | פריט תוכן הדרכה | `title`, `description`, `contentType`, `contentBody?`, `fileUrl?`, `externalUrl?`, `tags[]`, `category`, `createdBy`, `createdAt/updatedAt` |
| `trainingTags` | תגיות | `name`, `color?` |
| `trainingCategories` | קטגוריות | `name`, `order` |
| `donations` | תרומה | `donorName`, פרטי קשר, `type`, `amount?`, `description`, `itemsList?`, `date`, `notes` |

`trainingContent.tags` הוא מערך של **שמות** תגיות (מחרוזות), לא מזהים.

### הרשאות

| Collection | תיאור | שדות עיקריים |
|---|---|---|
| `userPermissions` | מזהה המסמך = Firebase Auth `uid` | `email`, `displayName`, `groupIds[]`, `customPageOverrides?: Record<route, action>` |
| `permissionGroups` | קבוצת הרשאות | `name`, `isDefault`, `pagePermissions: Record<route, 'view'\|'edit'\|'admin'>` |

השדה הישן `groupId` (יחיד) עדיין נתמך ומומר ל-`groupIds[]` בקריאה.

---

## קשרים בין ישויות

```
                          ┌──────────────┐
                          │   soldiers   │◄──────────────┐
                          └──────┬───────┘               │
        ┌────────────┬───────────┼───────────┬───────────┴──────┐
        │            │           │           │                  │
  statusEntries  equipment-  shampafEntries  assignments   routineTemplates
                 Assignments      │              │           .crewSlots[]
                     │            │              │                  │
                     ▼            ▼              ▼                  ▼
              equipmentTypes  shampafVacations  tanks ──► departments
                                                  ▲
                                          tankCrewAssignments

              routineVehicles ──► routineDepartments
                     ▲
              routineTemplates ──► routineChangeLogs

              platoons ──► squads          activations (סינון גלובלי בלבד)
              userPermissions ──► permissionGroups
```

**קרדינליות ומחיקות מדורגות** (נאכפות בקוד הלקוח בלבד, אין triggers):

| מחיקה | גורר |
|---|---|
| `soldier` | `equipmentAssignments`, `statusEntries`, `tankCrewAssignments`, `assignments`, `shampafEntries` + `shampafVacations` שלהם |
| `tank` | `tankCrewAssignments`, `assignments`, `routineTemplates` בעלי אותו `tankId` |
| `shampafEntry` | `shampafVacations` הבנים |
| `routineVehicle` | `routineTemplates` שלו + `routineChangeLogs` שלהם |
| `routineDepartment` | מאפס `departmentId` ברכבי השגרה (לא מוחק אותם) |
| `routineTemplate` | `routineChangeLogs` שלו (אחרי רישום log של `delete`) |

`activations` אינה קשורה בשום FK — היא רק **מסנן טווח תאריכים גלובלי** שנשמר ב-localStorage (`selectedActivationId`) ומשפיע על עמודי שמ"פ ושיבוץ.

---

## לוגיקה עסקית מרכזית

### חפיפת טווחי זמן

```ts
dateRangesOverlap(aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd
```

חפיפה **קפדנית** — טווחים שנוגעים בקצה בדיוק (`aEnd === bStart`) אינם נחשבים חופפים. זה מאפשר החלפת משמרות רציפה.

### היררכיית הזמינות של חייל

התפיסה המרכזית של המערכת:

```
שמ"פ (shampafEntry)  =  החייל מגויס ונמצא ביחידה
   └── חופשה/התארגנות (shampafVacation)  =  חלון בתוך השמ"פ שבו הוא לא זמין
         └── שיבוץ (assignment)  =  מה הוא עושה בפועל בחלון זמן
```

`ShampafStatus` נגזר: `mobilized` (יש שמ"פ פעיל, אין חופשה) / `vacation` / `preparation` / `none`.

### קונפליקטים בשיבוץ

`useAssignmentConflicts()` מחשב מפה `assignmentId → ConflictType[]` עבור כל השיבוצים שטרם הסתיימו:

| קונפליקט | מתי |
|---|---|
| `no_shampaf` | אין `shampafEntry` **שעוטף במלואו** את טווח השיבוץ |
| `on_vacation` | קיים `shampafVacation` (על אותו entry) שחופף לטווח השיבוץ |
| `overlapping_assignment` | לאותו חייל יש שיבוץ אחר פעיל שחופף בזמן |

הקונפליקטים הם **אזהרות ולא חסימות** — השיבוץ נשמר בכל מקרה, מוצג עם מסגרת אדומה מקווקוות בגאנט ובטבלה. פונקציית `addAssignment` מחזירה `{ id, warnings[] }`.

בנוסף, אזהרה תוצג אם `soldier.trainedRole` שונה מהתפקיד המשובץ (למעט מפקדים, שרשאים למלא כל תפקיד).

### שיבוץ מרובה (batch)

זרימת שני שלבים:
1. **הגדרה** — בחירת רכב/תפקיד/משימה, טווח תאריכים, ובחירת מספר חיילים מרשימה עם חיפוש.
2. **סקירה** — `checkBatchConflicts()` שולף את כל הנתונים בקריאה אחת ומחזיר קונפליקטים לכל חייל. לכל חייל נבחרת החלטה: `include` / `override` (מחיקת השיבוץ המתנגש) / `skip`. ברירת המחדל היא `skip` אם יש חפיפת שיבוצים.
3. השמירה מתבצעת ב-`writeBatch` יחיד (יצירות + מחיקות).

אותה תבנית קיימת לשמ"פ (`checkShampafBatchConflicts` + `addShampafEntriesBatch`).

### כללי שיבוץ לרכב

- **טנק** (`vehicleCategory: 'tank'`) — 4 סלוטים קבועים, מוצג כדיאגרמת טנק ויזואלית. שיבוץ לתפקיד מחליף את היושב הקיים.
- **רכב רגיל** (`vehicleCategory: 'standard'`) — רשימת אנשים ללא הגבלת מספר או תפקיד.
- בדיאלוג השיבוץ, רשימת החיילים מסוננת: מוסתרים חיילים שכבר משובצים לרכב בתאריך הנבחר; לתפקיד `commander` מוצגים רק חיילים עם `trainedRole === 'commander'`; לשאר התפקידים מוצגים תחילה המאומנים לתפקיד ואחריהם המפקדים.

### סטטוסים

`addStatusEntry` סוגר אוטומטית כל סטטוס פתוח קודם של אותו חייל (`endDate = startDate` של החדש) ואז יוצר את החדש — ב-batch אחד. הסטטוס הנוכחי הוא הרשומה ללא `endDate`.

---

## מסכים ופונקציונליות

| Route | שם | תיאור |
|---|---|---|
| `/` | לוח בקרה | כרטיסי מונים (חיילים, ציוד חתום, טנקים כשירים, בשירות פעיל), פילוח סטטוסים, 5 חיילים אחרונים |
| `/soldiers` | חיילים | רשימה עם חיפוש/סינון, הוספה |
| `/soldiers/:id` | פרופיל חייל | טאבים: פרטים אישיים (טופס מלא כולל מידות והערות רפואיות) / ציוד / סטטוס / צוות טנק. פעולות מהירות: חיוג, מייל, מחיקה |
| `/equipment` | ציוד | קטלוג סוגי ציוד, חתימות פעילות, החזרת ציוד |
| `/shampaf` | שמ"פ | טאב טבלה + טאב גאנט. ניהול הפעלות. חופשות/התארגנות מקוננות. 2 דוחות |
| `/assignments` | שיבוץ | 3 טאבים: טבלה (קיבוץ לפי רכב/חייל) / גאנט / טנקים (דיאגרמות + עריכה inline של שמות רכבים ומחלקות). יצירת רכב ומחלקה. ייצוא CSV + העתקה. 2 דוחות |
| `/routine` | שגרה | תבניות צוות קבועות לרכבי שגרה, מקובצות למחלקות. יומן שינויים. ייצוא CSV + העתקה |
| `/officer-tasks` | משימות קצין תורן | תצוגת מובייל: שיבוצים עתידיים מקובצים לפי יום ("היום"/"מחר"/תאריך), כרטיס לכל משימה עם "בוצע" ו"שבץ מחדש", FAB לשיבוץ מהיר |
| `/training` | הדרכה | ספריית תוכן עם קטגוריות ותגיות, חיפוש, העלאת קבצים ל-Storage, קישורים חיצוניים |
| `/donations` | תרומות | רישום תרומות + סטטיסטיקות (סה"כ כספי, מספר תורמים ייחודיים, פילוח לפי סוג) |
| `/reports` | דוחות | ייצוא CSV: רשימת חיילים (כולל מידות), ציוד חתום, שיבוץ טנקים |
| `/settings` | הגדרות | ערכת נושא, ניהול מחלקות, בחירת קטגוריות לשמירה מקומית, גיבוי/שחזור JSON, ייבוא CSV ממערכת ישנה, מיגרציית מידות, מחיקת כל הנתונים |
| `/permissions` | הרשאות | ניהול קבוצות הרשאה ומטריצת עמוד×פעולה, שיוך משתמשים לקבוצות, override פרטני |

**רכיבים רוחביים:**
- `AppShell` — sidebar בדסקטופ, bottom-nav במובייל (4 פריטים ראשיים + תפריט "עוד"), banner ניתוק רשת. פריטי הניווט מוסתרים אוטומטית לפי הרשאות.
- `Header` — בורר הפעלה גלובלי (נבחרת אוטומטית האחרונה), החלפת ערכת נושא, התנתקות.
- `GanttChart` — רכיב גנרי: שורות עם `bars`, בוררי טווח תאריכים, סמני חודשים, קו "היום", תמיכה בשורות כותרת (מחלקה/רכב) ובשורות משנה (תפקיד). RTL — הציר מתחיל מימין.
- `TankDiagram` — פריסה ויזואלית של 4 תפקידי הטנק.
- `ReportSection` — רכיב אחיד לכל דוח: בורר תאריך, כפתור "העתק", וגלגל שיניים לבחירת שדות שיופיעו בפלט (נשמר ב-localStorage לכל סוג דוח).

---

## מודל ההרשאות

**התחברות:** Google בלבד, דרך Firebase Auth (`signInWithPopup` עם fallback ל-`signInWithRedirect`). ללא התחברות אין גישה לשום מסך.

**Bootstrap:** ב-`onAuthStateChanged` נקראת `ensureUserPermission()`:
- אם אין עדיין אף `permissionGroup` — נוצרות שתי קבוצות: "מנהל מערכת" (`admin` לכל העמודים) ו"צופה" (`view` לכל העמודים למעט `/permissions` ו-`/settings`, מסומנת `isDefault`). המשתמש הראשון מקבל מנהל מערכת.
- משתמש חדש לאחר מכן מקבל את הקבוצה המסומנת `isDefault`.

**חישוב ההרשאה לעמוד:**
1. אם קיים `customPageOverrides[route]` — הוא גובר.
2. אחרת: הרמה **הגבוהה ביותר** מכל הקבוצות של המשתמש (`view` < `edit` < `admin`).
3. אם אין למשתמש מסמך `userPermissions` כלל — מוחזר `admin` (מצב bootstrap).

**אכיפה בשלוש שכבות:**
| שכבה | מה נאכף |
|---|---|
| ניווט | פריטי sidebar/bottom-nav מוסתרים ללא הרשאת צפייה |
| Route | `ProtectedRoute` מציג `AccessDenied` |
| Mutation | `requireEditPermission(route)` / `requireAdminPermission(route)` קוראות מחדש מ-Firestore וזורקות `PermissionDeniedError` |

**מיפוי mutations ל-routes** (לא תמיד אינטואיטיבי):
- `tanks`, `departments`, `tankCrewAssignments` → `/assignments`
- `platoons` → `/settings`
- `activations` → `/soldiers`
- `statusEntries` → `/soldiers`
- גיבוי/שחזור → `admin` על `/settings`

---

## דוחות וייצוא

**דוחות טקסטואליים** (`src/lib/report-generators.ts`) — מייצרים מחרוזת מעוצבת לתאריך נתון ומעתיקים ללוח, מוכנה להדבקה בוואטסאפ:

| דוח | מיקום | תוכן |
|---|---|---|
| דוח שיבוצים | `/assignments` | רכבים מקובצים למחלקות, לכל רכב הצוות לפי סדר התפקידים |
| דוח חילופים | `/assignments` | מי מתחיל ומי מסיים שיבוץ בתאריך |
| דוח שינויים | `/shampaf` | תחילת פעילות / שחרור בתאריך |
| דוח מצב | `/shampaf` | כל החיילים בשמ"פ פעיל, ולכל אחד: רכב+תפקיד, "בית", או "חופשה"/"התארגנות" |

לכל דוח ניתן לכבות שדות (מספר אישי, תפקיד, רכב, כותרות מחלקה) והבחירה נשמרת.

**ייצוא טבלאי** (`src/lib/export-utils.ts`):
- CSV עם BOM של UTF-8 (חובה לפתיחה תקינה של עברית ב-Excel), כל השדות עטופים במרכאות.
- העתקה ללוח כ-TSV — נדבק ישירות כטבלה ב-Excel/Sheets.

---

## גיבוי, ייבוא ומיגרציות

### גיבוי מלא (`src/db/backup.ts`)

- **ייצוא**: קריאת כל 23 ה-collections לקובץ JSON יחיד עם `version: 3` ו-`exportDate`.
- **ייבוא**: **דורס הכל** — מוחק כל collection ואז כותב מחדש ב-chunks של 500 (מגבלת Firestore batch). מסנן שדות מסוכנים (`__proto__`, `constructor`, `prototype`) ורשומות ללא `id` תקין.
- שתי הפעולות דורשות `admin` על `/settings`.

### ייבוא ממערכת ישנה (`src/db/import-legacy.ts`)

מקבל עד 5 קבצי CSV (חיילים, מחלקות, טנקים, סטטוסים, שיבוצים), ממפה מזהים ישנים למזהי UUID חדשים, מפצל שם מלא לפרטי+משפחה, ממפה תפקידים מעברית לאנגלית, ומאחד רשומות סטטוס "פעיל" מרובות לרשומת שמ"פ אחת מורחבת לכל חייל. שעות ברירת מחדל: 08:00 התחלה, 18:00 סיום (או 12:00 ל-`start_half === 'evening'`).

### מיגרציית מידות (`src/db/migrate-sizes.ts`)

התאמה לפי מספר אישי, מעדכנת רק מידות **חסרות** ושומרת את הערכים כמחרוזות גולמיות כפי שהופיעו במערכת המקורית.

---

## עבודה במצב לא-מקוון (PWA)

- `enableMultiTabIndexedDbPersistence` — Firestore מסנכרן cache מקומי בין טאבים.
- Service Worker דרך `vite-plugin-pwa` במצב `autoUpdate`, precache של כל נכסי ה-build.
- Manifest בעברית, RTL, `display: standalone`.
- `OfflineBanner` מוצג כשאין רשת ("מצב צפייה בלבד").
- ב-`/settings` יש מתגים לכל קטגוריית נתונים המציינים מה יישמר מקומית. **הערה**: המתגים נשמרים ב-Zustand אך אינם מחוברים כרגע ללוגיקת cache אמיתית — הם declarative בלבד.

---

## אבטחה

### Firestore Rules

- **קריאה**: כל משתמש מאומת קורא הכל.
- **כתיבה**: מותרת רק למשתמש מאומת שיש לו מסמך `userPermissions/{uid}` — plus ולידציות טיפוס בסיסיות ליצירה בכל collection.
- `routineChangeLogs` — append-only (אין `update`/`delete`).
- `userPermissions` — משתמש יכול ליצור/לקרוא/לעדכן את המסמך של עצמו; מחיקה רק למי שכבר יש הרשאת כתיבה.
- `match /{document=**} { allow read, write: if false; }` בסוף — deny by default.

> ⚠️ **פער ידוע**: הרשאות ה-view/edit/admin ברמת העמוד נאכפות **בצד הלקוח בלבד**. ב-Firestore, כל משתמש שיש לו מסמך הרשאות יכול לכתוב לכל collection. משתמש עם ידע טכני יכול לעקוף. אכיפה אמיתית דורשת קריאת `permissionGroups` בתוך ה-rules או מעבר ל-Cloud Functions.

### Storage Rules

קריאה למאומתים; כתיבה מוגבלת ל-25MB ולרשימת MIME types לבנה (PDF, Word, PowerPoint, טקסט, תמונות, וידאו). אותה ולידציה משוכפלת גם בצד הלקוח (`src/lib/storage.ts`) כדי לתת שגיאה ידידותית לפני ההעלאה.

### `npm run security-check`

סקריפט bash שסורק את `src/` ומדווח ב-3 רמות חומרה: מפתחות API קשיחים, `eval`/`innerHTML`/`dangerouslySetInnerHTML`, סודות קשיחים, קבצים עם כתיבות ל-Firestore ללא `requireEditPermission`, כתיבות ללא `stripUndefined`, `accept="*"`, `JSON.parse` עם type assertion, ולוגים עם מידע רגיש. יוצא עם קוד 2 בממצא CRITICAL/HIGH.

---

## פריסה

Render, static site (`render.yaml`):

```yaml
buildCommand: npm install && npm run build
staticPublishPath: ./dist
routes:
  - type: rewrite
    source: /*
    destination: /index.html    # נדרש ל-SPA routing
```

`firebase.json` מכיל רק rules — הפריסה של ה-rules נעשית ידנית:

```bash
npx firebase deploy --only firestore:rules,storage:rules
```

לאחר פריסה יש לוודא שהדומיין מופיע ב-Firebase Console → Authentication → Authorized domains, אחרת ההתחברות תיכשל עם `auth/unauthorized-domain`.

---

## חוב טכני ונקודות פתוחות

| נושא | פירוט |
|---|---|
| כפילות עולמות | `tanks`/`departments` מול `routineVehicles`/`routineDepartments` — מודל זהה כמעט לחלוטין, שני קודי-בסיס. `RoutineTemplate.tankId` מצביע לרכבי שגרה למרות שמו |
| קוד מת | `src/pages/StatusBoardPage.tsx` ו-`src/pages/TanksPage.tsx` אינם משויכים לאף route. `seedDatabase()` אינו נקרא מאף מקום |
| ישות ללא UI | `squads` מוגדרת בסכמה, ב-rules ובגיבוי — אך אין מסך לניהולה |
| `tankCrewAssignments` | מנגנון "צוות קבוע" שקדם ל-`assignments` המבוססות-זמן. עדיין נקרא בטאב "צוות טנק" בפרופיל החייל ובדוח הטנקים ב-`/reports`, אך אינו המקור לשיבוץ המבצעי |
| ביצועים | כל hook מאזין ל-collection **שלם** ומסנן בזיכרון. ב-`useAssignmentConflicts` נסרקות כל השיבוצים×שמ"פ×חופשות בכל snapshot. סביר לפלוגה (~100 חיילים), לא ישרוד סדרי גודל |
| `stripUndefined` שטחי | מסנן רק ברמה הראשונה של האובייקט. אובייקטים מקוננים (`personalItems`) עלולים להכיל `undefined` |
| מחיקות מדורגות בלקוח | אם המשתמש מאבד חיבור באמצע מחיקה מדורגת — נשארות רשומות יתומות. אין ניקוי |
| מיגרציה `groupId` → `groupIds` | שכבת תאימות עדיין בקוד בשלושה מקומות (`usePermissions`, `check-permission`, `ensureUserPermission`) |
| `VITE_GOOGLE_CLIENT_ID` | מוגדר ב-`.env.example` וב-`render.yaml` אך לא בשימוש |
| Cache toggles | המתגים ב-`/settings` אינם מחוברים ללוגיקה בפועל |
