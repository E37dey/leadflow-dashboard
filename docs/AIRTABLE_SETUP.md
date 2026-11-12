# Airtable: הקמת הבסיס

הבסיס של LEADFLOW (‏Base ID מתחיל ב-`app`). ארבע טבלאות. כל רשומה נושאת את המזהה של האפליקציה בשדה `ID`, כך שקישורים שורדים ייבוא חוזר.

**מאפייה וליד באותה טבלה.** כל מאפייה היא רשומה אחת בטבלה `Leads`. היא הופכת לליד רק כשמסמנים `Pipeline`. כך אין שתי רשומות לאותו עסק, ואין לידים מומצאים: הצנרת מתחילה ריקה ומתמלאת רק ממה שהמשתמש מוסיף.

## Leads (מאפיות ולידים)
| שדה | סוג | מקור | הערות |
|---|---|---|---|
| ID | Single line text (ראשי) | ייבוא | `M-<placeId של גוגל>`. מפתח ה-upsert |
| Full name | Single line text | Google Maps | שם העסק |
| Company | Single line text | ייבוא | קטגוריה ואזור |
| Phone | Single line text | Google Maps | |
| Email | Email | | לא קיים בנתוני גוגל |
| Source | Single select | ייבוא | `maps` |
| Created at | Date and time | Google Maps | מתי נאסף |
| City | Single line text | Google Maps | עיר כפי שגוגל מחזיר. עיר בלי אותיות (למשל טלפון) נדחית |
| Region | Single line text | ייבוא | `haifa / center / jerusalem / sharon / north / south`, לפי `src/domain/regions.ts` |
| Area | Single line text | Google Maps | שכונה, ואם אין, עיר |
| Category, Categories | Single line text | Google Maps | |
| Website, Maps URL | URL | Google Maps | |
| Rating | Number (1 ספרה) | Google Maps | ריק כשאין ביקורות. אף פעם לא 0 |
| Reviews | Number | Google Maps | |
| Stars 5..1 | Number | Google Maps | פירוט הביקורות |
| Price, Status, Hours, Images, Lat, Lng | לפי השם | Google Maps | Hours הוא JSON של `[{day, hours}]` |
| Brand, Record class, Duplicate of | Single line text | ייבוא | סיווג: `unique / branch / suspected_duplicate` |
| Pipeline | Checkbox | **משתמש** | מסומן = ליד בצנרת. הייבוא לא נוגע בו |
| Stage | Single select | **משתמש** | `new, contacted, qualified, proposal, won, lost`. ריק = לא בצנרת |
| Estimated value | Currency ₪ | **משתמש** | ריק = ״לא הוזן״ |
| Last contact at, Next follow-up at | Date and time | **משתמש** | |
| Notes | Long text | ייבוא | כתובת מגוגל |
| Activity log | Long text | ייבוא | JSON, רק רשומת המקור (מאיפה נאסף) |
| Owner | Link to Owners | ייבוא | |
| Activities | Link to Activities | אוטומטי | הצד השני של הקישור |

## Activities (פעילויות על ליד)
| שדה | סוג | הערות |
|---|---|---|
| ID | Single line text (ראשי) | `A-...`, נוצר בשרת |
| Lead | Link to Leads | חובה. פעילות בלי ליד קיים נדחית ומוצגת כשגיאה |
| Type | Single select | `note, call, email, meeting, stage` |
| Description | Long text | עד 2,000 תווים |
| Date | Date and time (Asia/Jerusalem, 24h) | |
| Next action | Single line text | לא חובה, עד 200 תווים |

## Owners, Tasks
`Owners`: ‏ID, ‏Name, ‏Initials, ‏Leads (קישור). `Tasks`: ‏ID, ‏Title, ‏Lead (קישור), ‏Due at, ‏Done, ‏Created at, ‏Rule ID. שייכות לנתוני ההדגמה; בנתוני האמת הן ריקות.

## תצוגות מומלצות ב-Airtable
- **צנרת:** ‏Leads, סינון `Pipeline` מסומן, תצוגת Kanban לפי `Stage`.
- **לפי אזור:** ‏Leads, קיבוץ לפי `Region`, מיון לפי `Reviews` יורד.
- **כפילויות חשודות:** ‏Leads, סינון `Record class` = `suspected_duplicate`.
- **פעילות אחרונה:** ‏Activities, מיון לפי `Date` יורד.

## טוקנים
- **לשרת הדאשבורד:** טוקן אחד עם `data.records:read`, ‏`data.records:write`, ‏`schema.bases:read`, ורק הבסיס הזה. נכנס למשתנה סביבה `AIRTABLE_TOKEN` של השרת (קובץ `.env.local` או משתנה במערכת), אף פעם לא לקוד ולא לדפדפן.
- **לייבוא:** אותו טוקן, דרך `node --env-file=<קובץ> scripts/places-to-airtable.mjs ...`.
- **ב-GitHub Pages** (אין שרת): אפשר עדיין להתחבר בהגדרות עם טוקן קריאה בלבד. אז אין כתיבה.

## חינמי
התוכנית החינמית מגבילה ל-1,000 רשומות לבסיס. כרגע: 469 מאפיות, 1 Owner, 0 Tasks, ופעילויות לפי שימוש. הסקריפט עוצר אם יש יותר מ-950 מאפיות.
