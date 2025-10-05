// routes/admin.js
const express = require('express');
const router = express.Router();
const normalize = require('../lib/normalize');

const Brand = require('../models/Brand');
const Device = require('../models/Device');
const PartCategory = require('../models/PartCategory');
const CompatibilityGroup = require('../models/CompatibilityGroup');
// add near top of routes/admin.js
const ExcelJS = require('exceljs');
const multer = require('multer');
const upload = multer({ dest: 'tmp/uploads' });
const fs = require('fs');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

// Helper to safe JSON parse
function tryParseJSON(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch(e) { return null; }
}


// DEBUG route to inspect exported workbook structure quickly
router.get('/export/debug', authMiddleware, adminOnly, async (req, res) => {
  try {
    const brands = await Brand.find().lean();
    const devices = await Device.find().populate('brand', 'name slug').lean();
    const parts = await PartCategory.find().lean();
    const groups = await CompatibilityGroup.find()
      .populate('partId', 'name slug')
      .populate('models', 'name slug')
      .lean();

    const workbook = new ExcelJS.Workbook();

    // ---- Brands ----
    const brandsSheet = workbook.addWorksheet('Brands');
    brandsSheet.addRow(['ACTION','id','name','slug','meta']);
    for (const b of brands) {
      brandsSheet.addRow([
        '',
        b._id?.toString(),
        b.name,
        b.slug,
        b.meta ? JSON.stringify(b.meta) : ''
      ]);
    }

    // ---- Devices ----
    const devicesSheet = workbook.addWorksheet('Devices');
    devicesSheet.addRow(['ACTION','id','brandId','brandSlug','brandName','name','slug','aliases','normalized','meta']);
    for (const d of devices) {
      const aliases = Array.isArray(d.aliases) ? d.aliases.join(', ') : '';
      const brandId = d.brand?._id ? d.brand._id.toString() : (d.brand ? d.brand.toString() : '');
      const brandSlug = d.brand?.slug || '';
      const brandName = d.brand?.name || '';
      devicesSheet.addRow([
        '',
        d._id?.toString(),
        brandId,
        brandSlug,
        brandName,
        d.name,
        d.slug,
        aliases,
        d.normalized || '',
        d.meta ? JSON.stringify(d.meta) : ''
      ]);
    }

    // ---- Parts ----
    const partsSheet = workbook.addWorksheet('Parts');
    partsSheet.addRow(['ACTION','id','name','slug','description','meta']);
    for (const p of parts) {
      partsSheet.addRow([
        '',
        p._id?.toString(),
        p.name,
        p.slug,
        p.description || '',
        p.meta ? JSON.stringify(p.meta) : ''
      ]);
    }

    // ---- Groups ----
    const groupsSheet = workbook.addWorksheet('Groups');
    groupsSheet.addRow(['ACTION','id','partId','partSlug','partName','modelsIds','modelsSlugs','note','source','tags','confidence']);
    for (const g of groups) {
      const modelIds = Array.isArray(g.models)
        ? g.models.map(m => m._id?.toString() || m.toString()).join(', ')
        : '';
      const modelSlugs = Array.isArray(g.models)
        ? g.models.map(m => m.slug || m.name || (m._id?.toString()||'')).join(', ')
        : '';
      const partId = g.partId?._id ? g.partId._id.toString() : (g.partId ? g.partId.toString() : '');
      const partSlug = g.partId?.slug || '';
      const partName = g.partId?.name || '';
      groupsSheet.addRow([
        '',
        g._id?.toString(),
        partId,
        partSlug,
        partName,
        modelIds,
        modelSlugs,
        g.note || '',
        g.source || '',
        Array.isArray(g.tags) ? g.tags.join(', ') : '',
        g.confidence || 1
      ]);
    }

    // ---- JSON summary with ALL rows ----
    const sheets = workbook.worksheets.map(ws => {
      const headers = (ws.getRow(1).values || [])
        .slice(1)
        .map(v => (v === null || v === undefined ? '' : v.toString()));

      const rows = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        rows.push(
          row.values.slice(1).map(v =>
            v === null || v === undefined ? '' : v.toString()
          )
        );
      });

      return {
        name: ws.name,
        headers,
        rows,
        firstRow: rows[0] || []
      };
    });

    res.json({ ok: true, sheets });
  } catch (err) {
    console.error('Export debug error', err);
    res.status(500).json({ error: err.message });
  }
});


// ---------- EXPORT route ----------
// improved export route (replace existing /export/all)
router.get('/export/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const brands = await Brand.find().lean();
    // populate brand on devices so we can export brand.slug & brand.name
    const devices = await Device.find().populate('brand', 'name slug').lean();
    const parts = await PartCategory.find().lean();
    // populate part & models for readable export
    const groups = await CompatibilityGroup.find()
      .populate('partId', 'name slug')
      .populate('models', 'name slug')
      .lean();

    const workbook = new ExcelJS.Workbook();

    // Brands sheet
    const brandsSheet = workbook.addWorksheet('Brands');
    brandsSheet.addRow(['ACTION','id','name','slug','meta']);
    for (const b of brands) {
      brandsSheet.addRow(['', b._id?.toString(), b.name, b.slug, b.meta ? JSON.stringify(b.meta) : '']);
    }

    // Devices sheet — include brandId + brandSlug + brandName for readability
    const devicesSheet = workbook.addWorksheet('Devices');
    devicesSheet.addRow(['ACTION','id','brandId','brandSlug','brandName','name','slug','aliases','normalized','meta']);
    for (const d of devices) {
      const aliases = Array.isArray(d.aliases) ? d.aliases.join(', ') : '';
      const brandId = d.brand?._id ? d.brand._id.toString() : (d.brand ? d.brand.toString() : '');
      const brandSlug = d.brand?.slug || '';
      const brandName = d.brand?.name || '';
      devicesSheet.addRow(['', d._id?.toString(), brandId, brandSlug, brandName, d.name, d.slug, aliases, d.normalized || '', d.meta ? JSON.stringify(d.meta) : '']);
    }

    // Parts sheet (unchanged)
    const partsSheet = workbook.addWorksheet('Parts');
    partsSheet.addRow(['ACTION','id','name','slug','description','meta']);
    for (const p of parts) {
      partsSheet.addRow(['', p._id?.toString(), p.name, p.slug, p.description || '', p.meta ? JSON.stringify(p.meta) : '']);
    }

    // Groups sheet — include part slug & model slugs (readable) and also keep ids
    const groupsSheet = workbook.addWorksheet('Groups');
    groupsSheet.addRow(['ACTION','id','partId','partSlug','partName','modelsIds','modelsSlugs','note','source','tags','confidence']);
    for (const g of groups) {
      const modelIds = Array.isArray(g.models) ? g.models.map(m => m._id?.toString() || m.toString()).join(', ') : '';
      const modelSlugs = Array.isArray(g.models) ? g.models.map(m => m.slug || m.name || (m._id?.toString()||'')).join(', ') : '';
      const partId = g.partId?._id ? g.partId._id.toString() : (g.partId ? g.partId.toString() : '');
      const partSlug = g.partId?.slug || '';
      const partName = g.partId?.name || '';
      groupsSheet.addRow(['', g._id?.toString(), partId, partSlug, partName, modelIds, modelSlugs, g.note || '', g.source || '', Array.isArray(g.tags) ? g.tags.join(', ') : '', g.confidence || 1]);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error', err);
    res.status(500).json({ error: err.message });
  }
});



// ---------- IMPORT route ----------

router.post('/import', authMiddleware, adminOnly,  upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required (form field name: file)' });

  const filePath = req.file.path;
  const summary = { created: 0, updated: 0, deleted: 0, errors: [] };
  const dry = (req.query.dry === '1' || req.query.dry === 'true');

  // detect if server supports transactions (replica set)
  let supportsTransactions = false;
  try {
    const admin = mongoose.connection.db.admin();
    // replSetGetStatus will succeed only on replica set members / mongos
    await admin.command({ replSetGetStatus: 1 });
    supportsTransactions = true;
  } catch (e) {
    supportsTransactions = false;
  }

  // If dry-run requested but transactions not supported, inform the client
  if (dry && !supportsTransactions) {
    try { fs.unlinkSync(filePath); } catch (_) {}
    return res.status(400).json({
      ok: false,
      error: 'dry-run requested but MongoDB transactions are not available on this server. Enable replica set for dry-run.',
      summary
    });
  }

  // start session only when transactions supported
  let session = null;
  let usingTransaction = false;
  try {
    if (supportsTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
      usingTransaction = true;
    } else {
      session = null;
      usingTransaction = false;
    }

    const S = session ? { session } : undefined;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    function buildHeaderIndex(sheet) {
      const vals = (sheet.getRow(1).values || []).slice(1);
      const map = {};
      vals.forEach((h, i) => {
        if (!h) return;
        map[String(h).trim()] = i + 1;
      });
      return map;
    }
    function v(row, hdrIndex, name, fallbackIndex) {
      const idx = hdrIndex[name];
      const cell = row.getCell(idx || fallbackIndex || 1);
      return (cell && cell.value !== null && cell.value !== undefined) ? String(cell.value).trim() : '';
    }

    // -------- BRANDS --------
    const bSheet = workbook.getWorksheet('Brands');
    if (bSheet) {
      const hdr = buildHeaderIndex(bSheet);
      const rows = bSheet.getRows(2, bSheet.rowCount - 1) || [];
      for (const r of rows) {
        try {
          const action = (v(r, hdr, 'ACTION', 1) || 'create').toLowerCase();
          const id = v(r, hdr, 'id', 2);
          const name = v(r, hdr, 'name', 3);
          const slug = v(r, hdr, 'slug', 4) || normalize(name);
          const meta = tryParseJSON(v(r, hdr, 'meta', 5));

          if (action === 'delete') {
            if (id) await Brand.findByIdAndDelete(id, S);
            else await Brand.findOneAndDelete({ slug }, S);
            summary.deleted++;
            continue;
          }

          if (!name) { summary.errors.push({ sheet: 'Brands', row: r.number, error: 'name required' }); continue; }

          if (action === 'update' && id) {
            const updated = await Brand.findByIdAndUpdate(id, { name, slug, meta }, { new: true, ...(S||{}) });
            if (updated) summary.updated++;
            else {
              await Brand.findOneAndUpdate({ slug }, { name, slug, meta }, { upsert: true, new: true, ...(S||{}) });
              summary.created++;
            }
          } else {
            const existing = session ? await Brand.findOne({ slug }).session(session) : await Brand.findOne({ slug });
            if (existing) {
              await Brand.findByIdAndUpdate(existing._id, { name, slug, meta }, { new: true, ...(S||{}) });
              summary.updated++;
            } else {
              if (session) await Brand.create([{ name, slug, meta }], { session });
              else await Brand.create({ name, slug, meta });
              summary.created++;
            }
          }
        } catch (errRow) { summary.errors.push({ sheet: 'Brands', row: r.number, error: errRow.message }); }
      }
    }

    // -------- PARTS --------
    const pSheet = workbook.getWorksheet('Parts');
    if (pSheet) {
      const hdr = buildHeaderIndex(pSheet);
      const rows = pSheet.getRows(2, pSheet.rowCount - 1) || [];
      for (const r of rows) {
        try {
          const action = (v(r, hdr, 'ACTION', 1) || 'create').toLowerCase();
          const id = v(r, hdr, 'id', 2);
          const name = v(r, hdr, 'name', 3);
          const slug = v(r, hdr, 'slug', 4) || normalize(name);
          const description = v(r, hdr, 'description', 5) || '';
          const meta = tryParseJSON(v(r, hdr, 'meta', 6));

          if (action === 'delete') {
            if (id) await PartCategory.findByIdAndDelete(id, S);
            else await PartCategory.findOneAndDelete({ slug }, S);
            summary.deleted++;
            continue;
          }

          if (!name) { summary.errors.push({ sheet: 'Parts', row: r.number, error: 'name required' }); continue; }

          if (action === 'update' && id) {
            await PartCategory.findByIdAndUpdate(id, { name, slug, description, meta }, { new: true, ...(S||{}) });
            summary.updated++;
          } else {
            const existing = session ? await PartCategory.findOne({ slug }).session(session) : await PartCategory.findOne({ slug });
            if (existing) {
              await PartCategory.findByIdAndUpdate(existing._id, { name, slug, description, meta }, { new: true, ...(S||{}) });
              summary.updated++;
            } else {
              if (session) await PartCategory.create([{ name, slug, description, meta }], { session });
              else await PartCategory.create({ name, slug, description, meta });
              summary.created++;
            }
          }
        } catch (errRow) { summary.errors.push({ sheet: 'Parts', row: r.number, error: errRow.message }); }
      }
    }

    // -------- DEVICES --------
    const dSheet = workbook.getWorksheet('Devices');
    if (dSheet) {
      const hdr = buildHeaderIndex(dSheet);
      const rows = dSheet.getRows(2, dSheet.rowCount - 1) || [];
      for (const r of rows) {
        try {
          const action = (v(r, hdr, 'ACTION', 1) || 'create').toLowerCase();
          const id = v(r, hdr, 'id', 2);
          const brandIdRaw = v(r, hdr, 'brandId');
          const brandSlugRaw = v(r, hdr, 'brandSlug') || v(r, hdr, 'brand');
          const name = v(r, hdr, 'name', 6) || v(r, hdr, 'brandName', 5) || '';
          const slug = v(r, hdr, 'slug', 7) || normalize(`${brandSlugRaw || ''} ${name}`);
          const aliasesRaw = v(r, hdr, 'aliases', 8);
          const normalized = v(r, hdr, 'normalized', 9) || normalize(name);
          const meta = tryParseJSON(v(r, hdr, 'meta', 10));

          if (action === 'delete') {
            if (id) await Device.findByIdAndDelete(id, S);
            else await Device.findOneAndDelete({ slug }, S);
            summary.deleted++;
            continue;
          }

          if (!name) { summary.errors.push({ sheet: 'Devices', row: r.number, error: 'name required' }); continue; }

          // resolve brand
          let brandDoc = null;
          if (brandIdRaw && /^[0-9a-fA-F]{24}$/.test(brandIdRaw)) {
            brandDoc = session ? await Brand.findById(brandIdRaw).session(session) : await Brand.findById(brandIdRaw);
          }
          if (!brandDoc && brandSlugRaw) {
            brandDoc = session ? await Brand.findOne({ slug: brandSlugRaw }).session(session) : await Brand.findOne({ slug: brandSlugRaw });
          }
          if (!brandDoc) { summary.errors.push({ sheet: 'Devices', row: r.number, error: `brand not found: ${brandIdRaw || brandSlugRaw}` }); continue; }

          const aliases = aliasesRaw ? aliasesRaw.split(',').map(a=>a.trim()).filter(Boolean) : [];

          if (action === 'update' && id) {
            await Device.findByIdAndUpdate(id, { brand: brandDoc._id, name, slug, aliases, normalized, meta }, { new: true, ...(S||{}) });
            summary.updated++;
          } else {
            const existing = session ? await Device.findOne({ slug }).session(session) : await Device.findOne({ slug });
            if (existing) {
              await Device.findByIdAndUpdate(existing._id, { brand: brandDoc._id, name, aliases, normalized, meta }, { new: true, ...(S||{}) });
              summary.updated++;
            } else {
              if (session) await Device.create([{ brand: brandDoc._id, name, slug, aliases, normalized, meta }], { session });
              else await Device.create({ brand: brandDoc._id, name, slug, aliases, normalized, meta });
              summary.created++;
            }
          }
        } catch (errRow) { summary.errors.push({ sheet: 'Devices', row: r.number, error: errRow.message }); }
      }
    }

    // -------- GROUPS --------
    const gSheet = workbook.getWorksheet('Groups');
    if (gSheet) {
      const hdr = buildHeaderIndex(gSheet);
      const rows = gSheet.getRows(2, gSheet.rowCount - 1) || [];
      for (const r of rows) {
        try {
          const action = (v(r, hdr, 'ACTION', 1) || 'create').toLowerCase();
          const id = v(r, hdr, 'id', 2);
          const partIdRaw = v(r, hdr, 'partId');
          const partSlugRaw = v(r, hdr, 'partSlug') || v(r, hdr, 'part');
          const modelsRaw = v(r, hdr, 'modelsSlugs') || v(r, hdr, 'models') || v(r, hdr, 'modelsIds') || '';
          const note = v(r, hdr, 'note', 8) || '';
          const source = v(r, hdr, 'source', 9) || '';
          const tagsRaw = v(r, hdr, 'tags', 10) || '';
          const confidence = parseFloat(v(r, hdr, 'confidence', 11) || '1');

          if (action === 'delete') {
            if (id) await CompatibilityGroup.findByIdAndDelete(id, S);
            else {
              const modelSlugs = modelsRaw.split(',').map(x=>x.trim()).filter(Boolean);
              const deviceDocs = modelSlugs.length ? (session ? await Device.find({ slug: { $in: modelSlugs } }).session(session) : await Device.find({ slug: { $in: modelSlugs } })) : [];
              const deviceIds = deviceDocs.map(d=>d._id);
              let partDoc = null;
              if (partIdRaw && /^[0-9a-fA-F]{24}$/.test(partIdRaw)) partDoc = session ? await PartCategory.findById(partIdRaw).session(session) : await PartCategory.findById(partIdRaw);
              if (!partDoc && partSlugRaw) partDoc = session ? await PartCategory.findOne({ slug: partSlugRaw }).session(session) : await PartCategory.findOne({ slug: partSlugRaw });
              if (partDoc && deviceIds.length) {
                await CompatibilityGroup.deleteMany({ partId: partDoc._id, models: { $all: deviceIds } }, S);
                summary.deleted++;
              } else summary.errors.push({ sheet: 'Groups', row: r.number, error: 'could not resolve part/models for delete' });
            }
            continue;
          }

          if (!partIdRaw && !partSlugRaw) { summary.errors.push({ sheet: 'Groups', row: r.number, error: 'part required' }); continue; }
          if (!modelsRaw) { summary.errors.push({ sheet: 'Groups', row: r.number, error: 'models required' }); continue; }

          let partDoc = null;
          if (partIdRaw && /^[0-9a-fA-F]{24}$/.test(partIdRaw)) partDoc = session ? await PartCategory.findById(partIdRaw).session(session) : await PartCategory.findById(partIdRaw);
          if (!partDoc && partSlugRaw) partDoc = session ? await PartCategory.findOne({ slug: partSlugRaw }).session(session) : await PartCategory.findOne({ slug: partSlugRaw });
          if (!partDoc) { summary.errors.push({ sheet: 'Groups', row: r.number, error: `part not found: ${partIdRaw || partSlugRaw}` }); continue; }

          const modelTokens = modelsRaw.split(',').map(x=>x.trim()).filter(Boolean);
          const idTokens = modelTokens.filter(t => /^[0-9a-fA-F]{24}$/.test(t));
          const slugTokens = modelTokens.filter(t => !/^[0-9a-fA-F]{24}$/.test(t));
          const deviceQuery = { $or: [] };
          if (idTokens.length) deviceQuery.$or.push({ _id: { $in: idTokens } });
          if (slugTokens.length) deviceQuery.$or.push({ slug: { $in: slugTokens } });
          const deviceDocs = (deviceQuery.$or.length) ? (session ? await Device.find(deviceQuery).session(session) : await Device.find(deviceQuery)) : [];
          if (deviceDocs.length !== modelTokens.length) { summary.errors.push({ sheet: 'Groups', row: r.number, error: 'some models not found', found: deviceDocs.map(d=>d.slug) }); continue; }
          const deviceIds = deviceDocs.map(d=>d._id);

          if (action === 'update' && id) {
            await CompatibilityGroup.findByIdAndUpdate(id, { partId: partDoc._id, models: deviceIds, note, source, tags: tagsRaw ? tagsRaw.split(',').map(t=>t.trim()) : [], confidence }, { new: true, ...(S||{}) });
            summary.updated++;
          } else {
            const existing = session ? await CompatibilityGroup.findOne({ partId: partDoc._id, models: { $all: deviceIds, $size: deviceIds.length } }).session(session) : await CompatibilityGroup.findOne({ partId: partDoc._id, models: { $all: deviceIds, $size: deviceIds.length } });
            if (existing) {
              await CompatibilityGroup.findByIdAndUpdate(existing._id, { note, source, tags: tagsRaw ? tagsRaw.split(',').map(t=>t.trim()) : [], confidence }, { new: true, ...(S||{}) });
              summary.updated++;
            } else {
              if (session) await CompatibilityGroup.create([{ partId: partDoc._id, models: deviceIds, note, source, tags: tagsRaw ? tagsRaw.split(',').map(t=>t.trim()) : [], confidence }], { session });
              else await CompatibilityGroup.create({ partId: partDoc._id, models: deviceIds, note, source, tags: tagsRaw ? tagsRaw.split(',').map(t=>t.trim()) : [], confidence });
              summary.created++;
            }
          }
        } catch (errRow) { summary.errors.push({ sheet: 'Groups', row: r.number, error: errRow.message }); }
      }
    }

    // commit/abort depending on transaction support
    if (usingTransaction && session) {
      if (dry) {
        await session.abortTransaction();
        await session.endSession();
        try { fs.unlinkSync(filePath); } catch(e){ }
        return res.json({ ok: true, dry: true, summary, note: 'dry-run: no changes committed (transaction aborted)' });
      } else {
        try {
          await session.commitTransaction();
        } catch (commitErr) {
          // abort & surface helpful error
          try { await session.abortTransaction(); } catch(_) {}
          await session.endSession();
          try { fs.unlinkSync(filePath); } catch(_) {}
          console.error('Commit error', commitErr);
          return res.status(500).json({ ok: false, error: 'Transaction commit failed - see server logs', summary, details: commitErr.message });
        }
        await session.endSession();
      }
    } else {
      // non-transactional (changes already applied directly)
      // dry-run case for non-transactional was already handled above (we returned 400)
    }

    try { fs.unlinkSync(filePath); } catch(e){}

    return res.json({ ok: true, summary });
  } catch (err) {
    // On error, abort/cleanup properly if we used transactions
    try {
      if (session && usingTransaction) await session.abortTransaction();
      if (session) await session.endSession();
    } catch (ee) { /* ignore */ }

    console.error('Import error', err);
    try { fs.unlinkSync(filePath); } catch(e){}

    return res.status(500).json({ error: err.message, summary });
  }
});

/*
  NOTE: This file is intentionally simple.
  In production protect these routes with auth (JWT/basic) or remove after data entry.
*/

// Create or get Brand
router.post('/brand', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const slug = normalize(name).replace(/\s+/g, '-');
    let b = await Brand.findOne({ slug });
    if (!b) b = await Brand.create({ name, slug });
    res.json(b);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create Device (upsert by slug)
router.post('/device', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const { brandSlug, brandName, name, aliases } = req.body;
    if (!name) return res.status(400).json({ error: 'device name required' });

    // find or create brand
    let brand;
    if (brandSlug) brand = await Brand.findOne({ slug: brandSlug });
    if (!brand && brandName) {
      const bslug = normalize(brandName).replace(/\s+/g, '-');
      brand = await Brand.findOneAndUpdate({ slug: bslug }, { name: brandName, slug: bslug }, { upsert: true, new: true });
    }
    if (!brand) return res.status(400).json({ error: 'brandSlug or brandName required' });

    const slug = normalize(`${brand.name} ${name}`).replace(/\s+/g,'-');
    const normalized = normalize(`${brand.name} ${name}`);
    let device = await Device.findOne({ slug });
    if (device) {
      // update aliases if provided
      if (Array.isArray(aliases) && aliases.length) {
        const merged = Array.from(new Set([...(device.aliases||[]), ...aliases.map(a => a.trim())]));
        device.aliases = merged;
        await device.save();
      }
      return res.json(device);
    }
    device = await Device.create({
      brand: brand._id,
      name: name.trim(),
      slug,
      aliases: Array.isArray(aliases) ? aliases : [],
      normalized
    });
    res.json(device);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create or get PartCategory
router.post('/part', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const slug = normalize(name).replace(/\s+/g, '-');
    let p = await PartCategory.findOne({ slug });
    if (!p) p = await PartCategory.create({ name, slug, description: req.body.description || '' });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all PartCategories
router.get('/parts', async (req, res) => {
  try {
    const parts = await PartCategory.find({}, 'name slug'); // fetch only name & slug for dropdown
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Create Compatibility Group (models: array of device slugs OR ids)
router.post('/group', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const { partSlug, partId, models } = req.body;
    if (!models || !Array.isArray(models) || models.length < 1) return res.status(400).json({ error: 'models[] required' });

    let part;
    if (partId) part = await PartCategory.findById(partId);
    else if (partSlug) part = await PartCategory.findOne({ slug: partSlug });
    if (!part) return res.status(400).json({ error: 'partSlug or partId required and must exist' });

    // resolve model identifiers: accept slugs or ids
    const deviceDocs = await Device.find({ $or: [{ slug: { $in: models } }, { _id: { $in: models.filter(m=>/^[0-9a-fA-F]{24}$/.test(m)) } }] });
    const deviceIds = deviceDocs.map(d => d._id);

    if (deviceIds.length !== models.length) {
      // some models not found — return what we found and list missing
      const foundSlugs = deviceDocs.map(d => d.slug);
      const missing = models.filter(m => !foundSlugs.includes(m) && !deviceIds.includes(m));
      return res.status(400).json({ error: 'some models not found', missing, found: deviceDocs });
    }

    // avoid duplicate group: exact members match
    const existing = await CompatibilityGroup.findOne({ partId: part._id, models: { $all: deviceIds, $size: deviceIds.length } });
    if (existing) return res.json({ ok: true, existing });

    const g = await CompatibilityGroup.create({
      partId: part._id,
      models: deviceIds,
      note: req.body.note || '',
      source: req.body.source || 'admin'
    });
    res.json({ ok: true, group: g });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add alias to device
router.post('/device/:slug/alias', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const slug = req.params.slug;
    const alias = (req.body.alias || '').trim();
    if (!alias) return res.status(400).json({ error: 'alias required' });
    const device = await Device.findOne({ slug });
    if (!device) return res.status(404).json({ error: 'device not found' });
    device.aliases = Array.from(new Set([...(device.aliases||[]), alias]));
    await device.save();
    res.json(device);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Simple delete group by id
router.delete('/group/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    await CompatibilityGroup.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BRAND CRUD ---
// Get all brands
router.get('/brands', async (req, res) => {
  try {
    const brands = await Brand.find();
    res.json(brands);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update brand
router.put('/brands/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const slug = normalize(name).replace(/\s+/g, '-');
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      { name, slug },
      { new: true }
    );
    res.json(brand);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete brand
router.delete('/brands/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    await Brand.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- DEVICE CRUD ---
// Get all devices
router.get('/devices', async (req, res) => {
  try {
    const devices = await Device.find().populate('brand', 'name slug');
    res.json(devices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update device
router.put('/devices/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const { name, aliases } = req.body;
    if (!name) return res.status(400).json({ error: 'device name required' });
    const slug = normalize(name).replace(/\s+/g, '-');
    const normalized = normalize(name);
    const device = await Device.findByIdAndUpdate(
      req.params.id,
      { name, slug, normalized, aliases: Array.isArray(aliases) ? aliases : [] },
      { new: true }
    );
    res.json(device);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /devices/:id  — permanent delete
router.delete('/devices/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // validate id early
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'invalid device id' });
    }

    const device = await Device.findByIdAndDelete(id);

    if (!device) return res.status(404).json({ error: 'device not found' });

    // OPTIONAL: any additional cleanup (logs, references) can go here

    res.status(200).json({ message: 'device deleted', deviceId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Delete device
router.delete('/device/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    await Device.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- PART CATEGORY CRUD ---
// Update part category
router.put('/parts/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const slug = normalize(name).replace(/\s+/g, '-');
    const part = await PartCategory.findByIdAndUpdate(
      req.params.id,
      { name, slug, description: req.body.description || '' },
      { new: true }
    );
    res.json(part);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete part category
router.delete('/parts/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    await PartCategory.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- COMPATIBILITY GROUP CRUD ---
// Get all groups
router.get('/groups', async (req, res) => {
  try {
    const groups = await CompatibilityGroup.find()
      .populate('partId', 'name slug')
      .populate('models', 'name slug');
    res.json(groups);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update group
router.put('/groups/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const { models, note, source } = req.body;

    let deviceIds = [];
    if (Array.isArray(models) && models.length) {
      const deviceDocs = await Device.find({
        $or: [
          { slug: { $in: models } },
          { _id: { $in: models.filter(m => /^[0-9a-fA-F]{24}$/.test(m)) } }
        ]
      });
      deviceIds = deviceDocs.map(d => d._id);
    }

    const updated = await CompatibilityGroup.findByIdAndUpdate(
      req.params.id,
      { models: deviceIds, note, source },
      { new: true }
    );
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// -------------------- NEW: Paginated / searchable routes --------------------
// Add these routes — they do not replace any existing ones.

function escapeRegExp(string) {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTextRegex(q) {
  if (!q) return null;
  const token = q.trim();
  if (!token) return null;
  return new RegExp(escapeRegExp(token), 'i');
}

/**
 * GET /brands/paginated
 * query: page, limit, q (search)
 * returns: { items, total, page, totalPages }
 */
router.get('/brands/paginated', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const q = (req.query.q || '').trim();
    const re = buildTextRegex(q);

    const filter = re ? { $or: [{ name: re }, { slug: re }] } : {};

    const [total, items] = await Promise.all([
      Brand.countDocuments(filter),
      Brand.find(filter).skip((page - 1) * limit).limit(limit).lean().select('name slug')
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    res.json({ items, total, page, totalPages });
  } catch (err) {
    console.error('GET /brands/paginated', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /devices/paginated
 * query: page, limit, q (search name/slug/aliases), brand (brand slug to filter)
 */
router.get('/devices/paginated', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const q = (req.query.q || '').trim();
    const brandFilter = (req.query.brand || '').trim(); // optional brand slug
    const re = buildTextRegex(q);

    const filter = re
      ? { $or: [{ name: re }, { slug: re }, { aliases: re }] }
      : {};

    if (brandFilter) {
      // try to resolve brand slug -> brand._id and add to filter; non-blocking if not found
      const brandDoc = await Brand.findOne({ slug: brandFilter }).select('_id').lean();
      if (brandDoc) filter.brand = brandDoc._id;
      else {
        // If brand slug doesn't match any, return empty result quickly
        return res.json({ items: [], total: 0, page, totalPages: 0 });
      }
    }

    const [total, items] = await Promise.all([
      Device.countDocuments(filter),
      Device.find(filter)
        .populate('brand', 'name slug')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .select('name slug aliases normalized brand')
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    res.json({ items, total, page, totalPages });
  } catch (err) {
    console.error('GET /devices/paginated', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /parts/paginated
 * query: page, limit, q (search name/slug/description)
 */
router.get('/parts/paginated', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const q = (req.query.q || '').trim();
    const re = buildTextRegex(q);

    const filter = re ? { $or: [{ name: re }, { slug: re }, { description: re }] } : {};

    const [total, items] = await Promise.all([
      PartCategory.countDocuments(filter),
      PartCategory.find(filter).skip((page - 1) * limit).limit(limit).lean().select('name slug description')
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    res.json({ items, total, page, totalPages });
  } catch (err) {
    console.error('GET /parts/paginated', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /groups/paginated
 * query: page, limit, q (search part name/slug, device name/slug, note, source)
 * This uses aggregation + lookups so you can search on joined fields.
 */
router.get('/groups/paginated', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const q = (req.query.q || '').trim();
    const re = buildTextRegex(q);

    const partColl = PartCategory.collection.name;
    const deviceColl = Device.collection.name;

    const pipeline = [
      // attach part
      { $lookup: { from: partColl, localField: 'partId', foreignField: '_id', as: 'part' } },
      { $unwind: { path: '$part', preserveNullAndEmptyArrays: true } },
      // attach devices
      { $lookup: { from: deviceColl, localField: 'models', foreignField: '_id', as: 'devices' } },
    ];

    if (re) {
      pipeline.push({
        $match: {
          $or: [
            { 'part.name': re },
            { 'part.slug': re },
            { 'devices.slug': re },
            { 'devices.name': re },
            { note: re },
            { source: re }
          ]
        }
      });
    }

    // facet -> items + total
    pipeline.push({
      $facet: {
        items: [
          { $sort: { _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          // project friendly output
          {
            $project: {
              _id: 1,
              part: { _id: '$part._id', name: '$part.name', slug: '$part.slug' },
              devices: { $map: { input: '$devices', as: 'd', in: { _id: '$$d._id', name: '$$d.name', slug: '$$d.slug' } } },
              note: 1,
              source: 1,
              tags: 1,
              confidence: 1,
              createdAt: 1,
              updatedAt: 1
            }
          }
        ],
        total: [{ $count: 'count' }]
      }
    });

    const agg = await CompatibilityGroup.aggregate(pipeline).allowDiskUse(true).exec();
    const items = (agg[0] && agg[0].items) || [];
    const total = (agg[0] && agg[0].total && agg[0].total[0] && agg[0].total[0].count) ? agg[0].total[0].count : 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({ items, total, page, totalPages });
  } catch (err) {
    console.error('GET /groups/paginated', err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
