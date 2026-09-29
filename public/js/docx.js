// Export Word (.docx) du CV et de la lettre — souvent demandé par les cabinets de recrutement et les
// plateformes d'emploi. Document ATS : une colonne, styles de titres Word (Titre 1), texte réel, aucune image,
// aucun tableau. Généré en local (WordprocessingML + ZIP écrit à la main), sans dépendance.

import { createZip } from './zip.js';
import { cvBlocks } from './plaintext.js';
import { letterBlocks, letterLang } from './letter.js';
import { getTemplate, effectivePalette } from './render.js';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Modèles à empattements : police Word équivalente (les polices libres du site ne sont pas installées chez le recruteur). */
const SERIF = new Set(['classique', 'executif', 'elegant', 'us-resume', 'registre', 'academique', 'chercheur']);

const xmlEsc = (s) => String(s ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const run = (text, rPr = '') => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;

/** Mise en page (twips : 1 mm ≈ 56,7) : marges de 18 mm, jamais sous 12 mm. */
function page(paper) {
  const margin = 1021;
  return paper === 'Letter'
    ? { w: 12240, h: 15840, margin, text: 12240 - 2 * margin }
    : { w: 11906, h: 16838, margin, text: 11906 - 2 * margin };
}

function paragraph(b, pg) {
  switch (b.t) {
    case 'name': return `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${run(b.text)}</w:p>`;
    case 'title': return `<w:p><w:pPr><w:pStyle w:val="Subtitle"/></w:pPr>${run(b.text)}</w:p>`;
    case 'contact': return `<w:p><w:pPr><w:pStyle w:val="Contact"/></w:pPr>${run(b.text)}</w:p>`;
    case 'h': return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run(b.text)}</w:p>`;
    case 'item':
      return `<w:p><w:pPr><w:pStyle w:val="ItemTitle"/><w:tabs><w:tab w:val="right" w:pos="${pg.text}"/></w:tabs></w:pPr>${run(b.text)}${
        b.date ? `<w:r><w:rPr><w:b w:val="0"/><w:color w:val="4D4D4D"/></w:rPr><w:tab/><w:t xml:space="preserve">${xmlEsc(b.date)}</w:t></w:r>` : ''}</w:p>`;
    case 'sub': return `<w:p><w:pPr><w:pStyle w:val="ItemSub"/></w:pPr>${run(b.text)}</w:p>`;
    case 'bullet':
      return `<w:p><w:pPr><w:pStyle w:val="Bullet"/><w:tabs><w:tab w:val="left" w:pos="284"/></w:tabs></w:pPr>${run('•')}<w:r><w:tab/></w:r>${run(b.text)}</w:p>`;
    case 'right': return `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>${run(b.text, b.bold ? '<w:b/>' : '')}</w:p>`;
    case 'signature': return `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="600"/></w:pPr>${run(b.text, '<w:b/>')}</w:p>`;
    case 'gap': return '<w:p/>';
    default:
      return `<w:p><w:pPr><w:pStyle w:val="${b.justify ? 'BodyJustified' : 'Normal'}"/></w:pPr>${b.label ? run(`${b.label} `, '<w:b/>') : ''}${run(b.text)}</w:p>`;
  }
}

function stylesXML({ font, accent, lang }) {
  const color = accent.replace('#', '').toUpperCase();
  const rFonts = `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>`;
  const style = (id, name, pPr, rPr, extra = '') => `<w:style w:type="paragraph"${id === 'Normal' ? ' w:default="1"' : ''} w:styleId="${id}"><w:name w:val="${name}"/>${
    id === 'Normal' ? '' : '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'}${extra}<w:qFormat/><w:pPr>${pPr}</w:pPr><w:rPr>${rPr}</w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${rFonts}<w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="${lang === 'en' ? 'en-GB' : 'fr-FR'}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${
  style('Normal', 'Normal', '', '')}${
  style('Title', 'Title', '<w:spacing w:after="40"/>', `<w:b/><w:color w:val="${color}"/><w:sz w:val="40"/><w:szCs w:val="40"/>`)}${
  style('Subtitle', 'Subtitle', '<w:spacing w:after="40"/>', '<w:b/><w:sz w:val="25"/><w:szCs w:val="25"/>')}${
  style('Contact', 'Coordonnées', '<w:spacing w:after="120"/>', '<w:color w:val="4D4D4D"/><w:sz w:val="19"/><w:szCs w:val="19"/>')}${
  style('Heading1', 'heading 1', `<w:keepNext/><w:spacing w:before="220" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${color}"/></w:pBdr><w:outlineLvl w:val="0"/>`, `<w:b/><w:caps/><w:color w:val="${color}"/><w:sz w:val="23"/><w:szCs w:val="23"/>`)}${
  style('ItemTitle', 'Élément', '<w:keepNext/><w:spacing w:before="100" w:after="0"/>', '<w:b/>')}${
  style('ItemSub', 'Organisme', '<w:keepNext/><w:spacing w:after="20"/>', `<w:color w:val="${color}"/>`)}${
  style('Bullet', 'Puce', '<w:ind w:left="284" w:hanging="284"/><w:spacing w:after="20"/>', '')}${
  style('BodyJustified', 'Corps justifié', '<w:jc w:val="both"/><w:spacing w:after="160"/>', '')}</w:styles>`;
}

/** Blocs → fichier .docx (Uint8Array). opts : { paper, accent, font, lang, title, author } */
export function blocksToDocx(blocks, opts = {}) {
  const pg = page(opts.paper);
  const body = blocks.map((b) => paragraph(b, pg)).join('');
  const documentXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="${pg.w}" w:h="${pg.h}"/><w:pgMar w:top="${pg.margin}" w:right="${pg.margin}" w:bottom="${pg.margin}" w:left="${pg.margin}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEsc(opts.title || 'CV')}</dc:title><dc:creator>${xmlEsc(opts.author || '')}</dc:creator><dc:language>${opts.lang === 'en' ? 'en' : 'fr'}</dc:language></cp:coreProperties>`;
  return createZip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
    { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'word/document.xml', data: documentXML },
    { name: 'word/styles.xml', data: stylesXML({ font: opts.font || 'Calibri', accent: opts.accent || '#1f3a5f', lang: opts.lang }) },
    { name: 'docProps/core.xml', data: core },
  ]);
}

function wordOptions(cv, template, lang, title) {
  const pal = effectivePalette(cv, template);
  const name = cv.meta.anonymous && title === 'CV' ? '' : [cv.identity.firstName, cv.identity.lastName].filter(Boolean).join(' ');
  return {
    paper: template.forceFormat ? template.format : cv.meta.paper,
    accent: cv.meta.accent || (pal && pal.accent) || '#1f3a5f',
    font: SERIF.has(template.id) ? 'Cambria' : 'Calibri',
    lang,
    title: name ? `${title} ${name}` : title,
    author: name,
  };
}

/** CV au format Word, dans l'ordre et la langue du modèle choisi. */
export function cvToDocx(cv, templateId = cv.meta.templateId) {
  const template = getTemplate(templateId);
  const { blocks, view } = cvBlocks(cv, template);
  return blocksToDocx(blocks, wordOptions(cv, template, view.lang, 'CV'));
}

/** Lettre de motivation au format Word. */
export function letterToDocx(cv, templateId = cv.meta.templateId, today = new Date()) {
  const template = getTemplate(templateId);
  return blocksToDocx(letterBlocks(cv, today), wordOptions(cv, template, letterLang(cv.letter), cv.letter.kind === 'stage' ? 'Demande de stage' : 'Lettre'));
}
