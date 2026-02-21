import { Command } from "commander";
import { registerSyncCommand } from "./commands/sync.js";
import { registerChangelogCommand } from "./commands/changelog.js";
import { registerInitCommand } from "./commands/init.js";

const program = new Command();

program
  .name("openfeedback")
  .description("CLI tool for OpenFeedback Engine — roadmap sync and changelog generation")
  .version("0.1.0");

registerSyncCommand(program);
registerChangelogCommand(program);
registerInitCommand(program);

program.parse();
