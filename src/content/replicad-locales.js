// Static presentation strings only. Never translate submitted CAD source, names or hashes.
export const REPLICAD_LOCALES = Object.freeze({
  "en": {
    "title": "Replicad artifact inspection",
    "intro": "Choose a local Replicad artifact JSON file. Preview only; no upload, signing, publication or independent geometry verification.",
    "file": "Local CAD artifact JSON",
    "idle": "No file selected.",
    "refused": "Refused",
    "tooLarge": "File exceeds 2 MB.",
    "loaded": "Local wireframe displayed. Geometry and hashes have not been independently verified.",
    "preview": "Static CAD wireframe preview",
    "nav": "Inspect Replicad CAD",
    "language": "Language"
  },
  "sv": {
    "title": "Granskning av Replicad-artefakt",
    "intro": "Välj en lokal JSON-fil med en Replicad-artefakt. Endast förhandsvisning; ingen uppladdning, signering, publicering eller oberoende geometriverifiering.",
    "file": "Lokal CAD-artefakt i JSON",
    "idle": "Ingen fil vald.",
    "refused": "Avvisad",
    "tooLarge": "Filen är större än 2 MB.",
    "loaded": "Lokal trådmodell visas. Geometri och kontrollsummor har inte verifierats oberoende.",
    "preview": "Statisk trådmodell av CAD",
    "nav": "Granska Replicad-CAD",
    "language": "Språk"
  },
  "ar": {
    "title": "فحص نموذج Replicad",
    "intro": "اختر ملف JSON محليًا لنموذج Replicad. عرض فقط، دون رفع أو توقيع أو نشر أو تحقق مستقل من الهندسة.",
    "file": "ملف نموذج CAD محلي بصيغة JSON",
    "idle": "لم يتم اختيار ملف.",
    "refused": "مرفوض",
    "tooLarge": "يتجاوز حجم الملف 2 ميغابايت.",
    "loaded": "تم عرض النموذج السلكي المحلي. لم يتم التحقق من الهندسة أو البصمات بشكل مستقل.",
    "preview": "معاينة سلكية ثابتة لنموذج CAD",
    "nav": "فحص نموذج Replicad",
    "language": "اللغة"
  },
  "zh": {
    "title": "Replicad 工件检查",
    "intro": "选择本地 Replicad 工件 JSON 文件。仅供预览，不上传、签名、发布或独立验证几何模型。",
    "file": "本地 CAD 工件 JSON",
    "idle": "未选择文件。",
    "refused": "已拒绝",
    "tooLarge": "文件超过 2 MB。",
    "loaded": "已显示本地线框。几何模型及摘要未经独立验证。",
    "preview": "静态 CAD 线框预览",
    "nav": "检查 Replicad CAD",
    "language": "语言"
  },
  "es": {
    "title": "Inspección de artefactos Replicad",
    "intro": "Elige un archivo JSON local de Replicad. Solo vista previa; sin carga, firma, publicación ni verificación independiente de geometría.",
    "file": "Archivo JSON local de CAD",
    "idle": "Ningún archivo seleccionado.",
    "refused": "Rechazado",
    "tooLarge": "El archivo supera 2 MB.",
    "loaded": "Se muestra la malla local. Ni la geometría ni sus huellas han sido verificadas independientemente.",
    "preview": "Vista previa estática de estructura CAD",
    "nav": "Inspeccionar CAD Replicad",
    "language": "Idioma"
  },
  "ru": {
    "title": "Просмотр артефактов Replicad",
    "intro": "Выберите локальный JSON-файл артефакта Replicad. Только просмотр: без загрузки, подписи, публикации и независимой проверки геометрии.",
    "file": "Локальный JSON-файл CAD",
    "idle": "Файл не выбран.",
    "refused": "Отклонено",
    "tooLarge": "Файл превышает 2 МБ.",
    "loaded": "Локальная каркасная модель показана. Геометрия и хеши независимо не проверены.",
    "preview": "Статический каркасный просмотр CAD",
    "nav": "Просмотреть CAD Replicad",
    "language": "Язык"
  }
});
export const REPLICAD_LANGUAGES = Object.freeze(['en','sv','ar','zh','es','ru']);
export function replicadLanguage(lang) {
 const code=typeof lang==='string' ? lang.toLowerCase().replace(/_/g,'-').split('-')[0] : 'en';
 return REPLICAD_LANGUAGES.includes(code)?code:'en';
}
export function replicadMessages(lang) { return REPLICAD_LOCALES[replicadLanguage(lang)]; }
