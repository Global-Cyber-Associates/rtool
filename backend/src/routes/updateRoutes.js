// backend/src/routes/updateRoutes.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GET /api/agent/update?app=agent-user (default) or ?app=agent-admin
router.get('/', (req, res) => {
    try {
        const appName = req.query.app === 'agent-admin' ? 'manifest-admin.json' : 'manifest-user.json';
        const manifestPath = path.join(__dirname, '../../public/updates/', appName);

        if (!fs.existsSync(manifestPath)) {
            // If specific manifest missing, fallback or 404? 
            // Better to 404 so agent knows configuration is wrong.
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

export default router;
