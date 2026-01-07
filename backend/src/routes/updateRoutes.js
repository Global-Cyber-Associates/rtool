// backend/src/routes/updateRoutes.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import Tenant from '../models/Tenant.js';
import AgentDownload from '../models/AgentDownload.js';
import mongoose from 'mongoose';

// GET /api/agent/update?app=agent-user (default) or ?app=agent-admin
router.get('/', (req, res) => {
    try {
        const appName = req.query.app === 'agent-admin' ? 'manifest-admin.json' : 'manifest-user.json';
        const manifestPath = path.join(__dirname, '../../public/updates/', appName);

        if (!fs.existsSync(manifestPath)) {
            console.error(`Manifest not found: ${manifestPath}`);
            return res.status(404).json({ message: 'No update manifest found for this app' });
        }

        const manifest = fs.readFileSync(manifestPath, 'utf8');
        res.json(JSON.parse(manifest));
    } catch (error) {
        console.error('Update check error:', error);
        res.status(500).json({ message: 'Internal server error checking updates' });
    }
});

// GET /api/agent/update/download?app=agent-user&tenantId=...&tenantKey=...
router.get('/download', async (req, res) => {
    try {
        const { app, tenantId, tenantKey } = req.query;

        if (!app || (!tenantId && !tenantKey)) {
            return res.status(400).json({ message: 'Missing app or tenant identifier (tenantId or tenantKey)' });
        }

        let finalTenant = null;

        // 1. Resolve Tenant
        if (tenantKey) {
            finalTenant = await Tenant.findOne({ enrollmentKey: tenantKey });
        } else if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
            finalTenant = await Tenant.findById(tenantId);
        }

        if (!finalTenant) {
            return res.status(403).json({ message: 'Access denied: Invalid tenant enrollment' });
        }

        // 2. Map File
        const fileName = app.endsWith('.zip') ? app : `${app}.zip`;
        const filePath = path.join(__dirname, '../../public/updates/', fileName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Update file not found' });
        }

        // 3. Log Download
        await AgentDownload.create({
            tenantId: finalTenant._id,
            appName: app,
            ip: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        console.log(`📡 [DOWNLOAD] ${app} downloaded for tenant ${finalTenant.name} (${finalTenant._id}) from ${req.ip}`);

        // 4. Send File
        res.download(filePath, fileName);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Error processing download' });
    }
});

export default router;
