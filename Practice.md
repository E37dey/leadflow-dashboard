# Practice: איך עובדים בפרויקט הזה

## לפני כל בקשה
1. קוראים את SPEC.md. אם הבקשה לא שם, מעדכנים קודם את ה-SPEC ב-PR נפרד, ורק אחר כך כותבים קוד.
2. פותחים branch חדש מ-main:
   ```
   git switch main
   git pull
   git switch -c feat/<שם-קצר>
   ```

## כל בקשה עוברת ארבעה שלבים
1. **Review:** מה ב-SPEC הבקשה מכסה, ואיזה ״Done means״ בודק אותה.
2. **Build:** כותבים את הקוד. לוגיקה ב-`src/domain`, תצוגה ב-`src/features` ו-`src/components`.
3. **Test:**
   ```
   npm test
   npm run lint
   npm run build
   ```
   ובודקים בדפדפן (`npm run dev`) במחשב ובטלפון.
4. **Commit:** הודעה שאומרת מה השתנה, ושורת `Spec:` שמפנה לסעיף.

## שמירה ועדכון ב-GitHub
```
git add <הקבצים>
git commit -m "feat: ..." -m "Spec: Must 5"
git push -u origin feat/<שם-קצר>
gh pr create --fill --base main
gh pr merge --merge --delete-branch
git switch main
git pull
```
אחרי merge ל-main, GitHub Actions בונה ומפרסם ל-GitHub Pages לבד.

## כללים
- לא עובדים ישירות על main.
- אין סודות בריפו: לא מפתחות, לא סיסמאות, לא קובצי `.env`.
- באג שלא קשור לבקשה הנוכחית: פותחים Issue, לא מתקנים באמצע.
- טעות של Claude חוזרת? מתקנים את הקובץ (SPEC, Practice, CLAUDE.md), לא רק את השיחה.
