#!/usr/bin/env node
import { Command } from 'commander';
import { checkbox, input, confirm, select } from '@inquirer/prompts';
import { M as Marketplace, E as ExtractedItem } from './schemas-DMrEtNbG.js';
import 'zod';

declare function runDoctorCommand(options: {
    apiBaseUrl?: string;
    images?: string[];
    output?: string;
}, dependencies?: {
    apiSupportCheck?: (url: string) => Promise<boolean>;
    nodeVersion?: string;
    reachabilityCheck?: (url: string) => Promise<boolean>;
}): Promise<{
    exitCode: number;
    output: string;
    result: {
        humanReadable: string;
        checks: {
            status: "pass" | "fail";
            message: string;
            name: string;
        }[];
        ok: boolean;
    };
}>;

type PromptDependencies = {
    checkbox: typeof checkbox;
    input: typeof input;
};
type ReviewPromptDependencies = {
    confirm: typeof confirm;
    input: typeof input;
    select: typeof select;
};
declare function collectInteractiveInputs(dependencies?: PromptDependencies): Promise<{
    imageUrls: string[];
    marketplaces: Marketplace[];
}>;
declare function reviewExtractedItem(item: ExtractedItem, dependencies?: ReviewPromptDependencies): Promise<{
    attributes: Record<string, string>;
    category: string;
    condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
    description: string;
    missingFields: string[];
    title: string;
    uncertainties: string[];
    tcg?: {
        set?: string | undefined;
        cardName?: string | undefined;
        cardNumber?: string | undefined;
        foil?: boolean | undefined;
        game?: string | undefined;
        language?: string | undefined;
        rarity?: string | undefined;
    } | undefined;
}>;

declare function runGenerateCommand(options: {
    apiBaseUrl?: string;
    images?: string[];
    input?: string;
    interactive?: boolean;
    marketplaces?: string;
    output?: string;
}, dependencies?: {
    collectInputs?: typeof collectInteractiveInputs;
    fetchImpl?: typeof fetch;
    readTextFile?: (path: string) => Promise<string>;
    reviewer?: typeof reviewExtractedItem;
}): Promise<{
    exitCode: number;
    output: string;
    result: {
        status: "ready" | "needs_input";
        extractedItem: {
            attributes: Record<string, string>;
            category: string;
            condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
            description: string;
            missingFields: string[];
            title: string;
            uncertainties: string[];
            tcg?: {
                set?: string | undefined;
                cardName?: string | undefined;
                cardNumber?: string | undefined;
                foil?: boolean | undefined;
                game?: string | undefined;
                language?: string | undefined;
                rarity?: string | undefined;
            } | undefined;
        };
        humanReadable: string;
        listings: {
            description: string;
            title: string;
            copyBlock: string;
            marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
            notesToSeller: string[];
            bullets?: string[] | undefined;
            itemSpecifics?: Record<string, string> | undefined;
        }[];
        schemaVersion: string;
        skippedMarketplaces: {
            marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
            reason: string;
        }[];
    };
}>;

type CliDependencies = {
    runDoctorCommand?: typeof runDoctorCommand;
    runGenerateCommand?: typeof runGenerateCommand;
    setExitCode?: (value: number) => void;
    stderr?: Pick<NodeJS.WriteStream, 'write'>;
    stdout?: Pick<NodeJS.WriteStream, 'write'>;
};
declare function buildCli(dependencies?: CliDependencies): Command;
declare function runCli(argv?: string[]): Promise<void>;

export { buildCli, runCli };
