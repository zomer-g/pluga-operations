export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Translate Postgres constraint errors into messages the UI can show as-is.
export function toHttpError(err) {
  if (err instanceof HttpError) return err;
  switch (err?.code) {
    case '23503':
      return new HttpError(409, 'הפעולה נכשלה: הרשומה מקושרת לרשומה אחרת שחסרה או שעדיין בשימוש');
    case '23505':
      return new HttpError(409, 'הפעולה נכשלה: רשומה כזו כבר קיימת');
    case '23514':
      return new HttpError(400, 'הפעולה נכשלה: ערך לא חוקי באחד השדות');
    case '23502':
      return new HttpError(400, `הפעולה נכשלה: חסר שדה חובה (${err.column ?? ''})`);
    case '22007':
    case '22008':
      return new HttpError(400, 'הפעולה נכשלה: תאריך לא תקין');
    case '22P02':
    case '22003':
      return new HttpError(400, 'הפעולה נכשלה: ערך מספרי לא תקין');
    default:
      return new HttpError(500, 'שגיאת שרת');
  }
}
