import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";

async function fileExists(filePath: string) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export function registerInitCommand(program: Command) {
    program
        .command("init")
        .description("Initialize OpenFeedback in the current Next.js application")
        .option("--cwd <dir>", "Directory to run command in", process.cwd())
        .action(async (options) => {
            const targetDir = path.resolve(options.cwd);

            console.log("🚀 Initializing OpenFeedback Engine...");

            // 1. Detect if it's a Next.js App Router project
            const hasAppSrcDir = await fileExists(path.join(targetDir, "src", "app"));
            const hasAppRootDir = await fileExists(path.join(targetDir, "app"));

            if (!hasAppSrcDir && !hasAppRootDir) {
                console.error("❌ Could not find a Next.js App Router (app/ or src/app/ directory).");
                process.exit(1);
            }

            const appDir = hasAppSrcDir
                ? path.join(targetDir, "src", "app")
                : path.join(targetDir, "app");

            const actionsDir = path.join(appDir, "actions");

            // 2. Create actions/openfeedback.ts
            await fs.mkdir(actionsDir, { recursive: true });
            const actionsFile = path.join(actionsDir, "openfeedback.ts");

            // Simulating a bundled template copying process (we use a hardcoded string for the CLI bundle to avoid missing asset files in tsup)
            const actionTemplate = `"use server";\n\nimport { createServerSideSigner } from "@openfeedback/client";\n\nconst { signSuggestion, signVote } = createServerSideSigner({\n  hmacSecret: process.env.OPENFEEDBACK_HMAC_SECRET!,\n});\n\nexport { signSuggestion, signVote };\n`;

            await fs.writeFile(actionsFile, actionTemplate, "utf-8");
            console.log(`✅ Default Server Action created at ${path.relative(targetDir, actionsFile)}`);

            // 3. Inject Provider into layout.tsx
            const rootLayoutPathTsx = path.join(appDir, "layout.tsx");
            const rootLayoutPathJsx = path.join(appDir, "layout.jsx");

            let layoutPath = null;
            if (await fileExists(rootLayoutPathTsx)) layoutPath = rootLayoutPathTsx;
            else if (await fileExists(rootLayoutPathJsx)) layoutPath = rootLayoutPathJsx;

            if (layoutPath) {
                let layoutContent = await fs.readFile(layoutPath, "utf-8");

                // Basic AST Regex replacement logic tailored for typical Next.js layouts
                if (!layoutContent.includes("OpenFeedbackProvider")) {
                    // Add import at the top
                    layoutContent = `import { OpenFeedbackProvider } from "@openfeedback/react";\n` + layoutContent;

                    // Regex to wrap {children}
                    const childrenRegex = /({children})/;
                    if (childrenRegex.test(layoutContent)) {
                        layoutContent = layoutContent.replace(
                            childrenRegex,
                            `/* Required configuration props omitted for brevity in CLI auto-setup */\n        <OpenFeedbackProvider config={{}} anonKey={process.env.NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY!} authContext={{ userId: "anon" }}>\n          $1\n        </OpenFeedbackProvider>`
                        );
                        await fs.writeFile(layoutPath, layoutContent, "utf-8");
                        console.log(`✅ OpenFeedbackProvider injected into ${path.relative(targetDir, layoutPath)}`);
                    } else {
                        console.warn(`⚠️  Could not automatically inject Provider in layout.tsx. Please wrap your application manually.`);
                    }
                } else {
                    console.log(`ℹ️  OpenFeedbackProvider is already present in layout.tsx.`);
                }
            }

            // 4. Update .env.local
            const envPath = path.join(targetDir, ".env.local");
            const envPlaceholders = `\n# OpenFeedback Engine Secrets\n# Get these from your Admin Dashboard\nNEXT_PUBLIC_OPENFEEDBACK_URL="https://your-project.supabase.co"\nNEXT_PUBLIC_OPENFEEDBACK_ANON_KEY="your-anon-key"\nOPENFEEDBACK_HMAC_SECRET="your-hmac-secret"\n`;

            if (await fileExists(envPath)) {
                const envContent = await fs.readFile(envPath, "utf-8");
                if (!envContent.includes("OPENFEEDBACK_HMAC_SECRET")) {
                    await fs.appendFile(envPath, envPlaceholders, "utf-8");
                    console.log("✅ Credentials placeholder added to .env.local");
                } else {
                    console.log("ℹ️  Credentials placeholder already exists in .env.local");
                }
            } else {
                await fs.writeFile(envPath, envPlaceholders, "utf-8");
                console.log("✅ Created .env.local with credentials placeholder");
            }

            console.log("\n🎉 Setup completed!");
            console.log("Next steps:");
            console.log("  1. Update `.env.local` with your Dashboard credentials.");
            console.log("  2. Place `<FeedbackBoard />` in any page you want!\n");
        });
}
