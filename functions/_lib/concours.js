// Concours annoncés : liste tenue À LA MAIN par l'administration, chaque entrée avec sa source officielle (lien vers
// l'avis : Journal officiel, site du ministère ou de l'école, presse). Aucun concours n'est inventé ni recopié
// automatiquement ; les candidats les ajoutent à « mes concours » d'un geste, puis vérifient l'avis.
import { HttpError, json, readJson, nowIso, randomToken } from './http.js';
import { audit } from './db.js';
import { FAMILIES } from '../../public/js/concours-core.js';

const t = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);

export function cleanAnnonce(b = {}) {
  const source = t(b.source_url, 400);
  let ok = false;
  try { ok = /^https:\/\//i.test(source) && Boolean(new URL(source).hostname); } catch { ok = false; }
  if (!ok) throw new HttpError(400, 'Le lien vers l’avis officiel (https://…) est obligatoire.');
  const title = t(b.title, 160);
  if (!title) throw new HttpError(400, 'Intitulé du concours manquant.');
  return { title, family: FAMILIES[b.family] ? b.family : 'autre', organisme: t(b.organisme, 160), deadline: day(b.deadline), exam: day(b.exam),
    source_url: source, notes: t(b.notes, 600), published: b.published === false ? 0 : 1 };
}

const fields = 'id, title, family, organisme, deadline, exam, source_url, notes, published, created_at, updated_at';

export const concoursRoutes = [
  // Public : concours publiés dont une date (dépôt ou épreuves) n'est pas encore passée, ou sans date connue.
  ['GET', /^\/api\/concours$/, async ({ db }) => {
    const today = nowIso().slice(0, 10);
    const r = await db.prepare(`SELECT ${fields} FROM concours_annonces WHERE published = 1
      AND (COALESCE(deadline, exam) IS NULL OR deadline >= ?1 OR exam >= ?1) ORDER BY COALESCE(deadline, exam, '9999') LIMIT 60`).bind(today).all();
    return json({ concours: r.results }, 200, { 'cache-control': 'public, max-age=600' });
  }],
];

export const concoursAdminRoutes = [
  ['GET', /^\/api\/admin\/concours$/, async ({ db }) => {
    const r = await db.prepare(`SELECT ${fields} FROM concours_annonces ORDER BY created_at DESC LIMIT 200`).all();
    return json({ concours: r.results });
  }],
  ['POST', /^\/api\/admin\/concours$/, async ({ db, request, admin }) => {
    const b = await readJson(request, 6000);
    const a = cleanAnnonce(b);
    const now = nowIso();
    if (b.id) {
      const r = await db.prepare(`UPDATE concours_annonces SET title = ?, family = ?, organisme = ?, deadline = ?, exam = ?, source_url = ?, notes = ?, published = ?, updated_at = ? WHERE id = ?`)
        .bind(a.title, a.family, a.organisme, a.deadline, a.exam, a.source_url, a.notes, a.published, now, String(b.id)).run();
      if (!r.meta?.changes) throw new HttpError(404, 'Concours introuvable.');
      await audit(db, admin, 'concours.update', String(b.id), a.title);
      return json({ ok: true, id: b.id });
    }
    const id = `cc-${randomToken(9)}`;
    await db.prepare(`INSERT INTO concours_annonces (id, title, family, organisme, deadline, exam, source_url, notes, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, a.title, a.family, a.organisme, a.deadline, a.exam, a.source_url, a.notes, a.published, now, now).run();
    await audit(db, admin, 'concours.create', id, a.title);
    return json({ ok: true, id }, 201);
  }],
  ['POST', /^\/api\/admin\/concours\/([\w-]{1,40})\/delete$/, async ({ db, admin, params }) => {
    await db.prepare('DELETE FROM concours_annonces WHERE id = ?').bind(params[0]).run();
    await audit(db, admin, 'concours.delete', params[0]);
    return json({ ok: true });
  }],
];
