// @ts-nocheck
import { Command } from "commander";
import { setConfigValue, getConfigValue } from "@seoagent/core";
import { withErrorHandler } from "../helpers.js";

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Configuration management");

  config
    .command("set <key> <value>")
    .description("Set a config value (dot-notation, e.g. dataforseo.login)")
    .action(
      withErrorHandler(async (key: string, value: string) => {
        setConfigValue(key, value);
        console.log(`Set ${key} = ${value}`);
      })
    );

  config
    .command("get <key>")
    .description("Get a config value")
    .action(
      withErrorHandler(async (key: string) => {
        const value = getConfigValue(key);
        if (value === undefined) {
          console.log(`${key} is not set.`);
        } else {
          console.log(`${key} = ${typeof value === "object" ? JSON.stringify(value) : value}`);
        }
      })
    );
}
