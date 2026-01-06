
import { connectMongo } from "./src/db.js";
import Tenant from "./src/models/Tenant.js";
import path from "path";
import fs from "fs";

const configPath = path.resolve("./config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const getKeys = async () => {
    try {
        await connectMongo(config.mongo_uri);
        console.log("Connected to DB. Fetching Tenants...");

        const tenants = await Tenant.find({});
        tenants.forEach(t => {
            console.log(`[TENANT] Name: ${t.name} | Key: ${t.enrollmentKey}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
getKeys();
