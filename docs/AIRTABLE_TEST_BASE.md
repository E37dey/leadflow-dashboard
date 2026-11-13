# בסיס בדיקה ב-Airtable (חמש דקות)

כך בודקים את LEADFLOW עם טוקן ובסיס משלכם, בלי הבסיס שלי. הנתונים בתבנית בדויים ומסומנים "דמה".

## 1. בסיס עם טבלת Leads
1. ב-Airtable: Create, ‏Start from scratch (בסיס חדש וריק).
2. בטבלה הראשונה: שם הטבלה `Leads` (בדיוק כך, באנגלית).
3. ייבוא: Add or import, ‏CSV file, ובוחרים את [`Leads.csv`](../public/airtable-template/Leads.csv) (אפשר להוריד אותו גם ממסך ההתחברות). מייבאים לטבלה הקיימת `Leads`, או יוצרים ממנו טבלה חדשה ומשנים את השם שלה ל-`Leads`.
4. ‏Base ID: הוא בכתובת של הבסיס, החלק שמתחיל ב-`app` (למשל `https://airtable.com/appXXXXXXXXXXXXXX/...`). במסך ההתחברות אפשר להדביק את כל הכתובת.

## 2. טוקן
1. תמונת הפרופיל, ‏Builder hub, ‏Personal access tokens, ‏Create token.
2. ‏Scopes: ‏`data.records:read`, ‏`schema.bases:read`.
3. ‏Access: רק בסיס הבדיקה.
4. מעתיקים את הטוקן (מתחיל ב-`pat`). Airtable מציג אותו פעם אחת בלבד.

## 3. התחברות
פותחים את הדאשבורד. מסך ההתחברות מופיע לפני כל נתון. מדביקים טוקן ו-Base ID ולוחצים "התחברות". אחרי טעינה מוצלחת מופיעות 12 מאפיות הדמה בשישה אזורים, ובסרגל העליון "Airtable מחובר".

## מה הבסיס צריך
| שדה | חובה | הערה |
|---|---|---|
| ID | כן | מזהה ייחודי, למשל `DEMO-01` |
| Full name | כן | שם העסק |
| Source | כן | אחד מ: `maps`, ‏`website`, ‏`facebook`, ‏`instagram`, ‏`referral`, ‏`telephone` |
| Created at | לא | ריק = תאריך יצירת הרשומה ב-Airtable |
| City, ‏Region, ‏Area, ‏Category, ‏Website, ‏Rating, ‏Reviews, ‏Lat, ‏Lng, ‏Status | לא | Region אחד מ: `haifa`, ‏`center`, ‏`jerusalem`, ‏`sharon`, ‏`north`, ‏`south` |
| Pipeline, ‏Stage, ‏Estimated value | לא | Pipeline מסומן = ליד בצנרת. Stage אחד מ: `new`, ‏`contacted`, ‏`qualified`, ‏`proposal`, ‏`won`, ‏`lost` |

הטבלאות `Owners` ו-`Tasks` לא חובה. אם הן לא קיימות, הן נטענות ריקות ומופיעה הערה. מספרים ותיבות סימון שיובאו כטקסט ("4.6", ‏"true") נקראים נכון. רשומה עם ערך שגוי (שלב או מקור לא מוכר, תאריך לא תקין) לא נטענת, ומספר הרשומות שנדחו מוצג בהגדרות.

## מה קורה כשמשהו לא נכון
| מה רואים | למה |
|---|---|
| הטוקן לא תקין או שפג תוקפו (401) | הטוקן הועתק חלקית, או נמחק |
| אין גישה (403) או לא נמצא (404) | ב-Access של הטוקן לא נבחר הבסיס, Base ID של בסיס אחר, או שאין טבלה בשם `Leads`. Airtable מחזיר 403 גם על טבלה שלא קיימת |
| לא נמצאו לידים בטבלה Leads | הטבלה קיימת וריקה |
