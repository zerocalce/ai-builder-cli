import { CLICommand, CommandArgs, Logger } from '../types';
import { CLIInterface } from '../cli/interface';
import { ProjectManagerImpl } from '../core/project-manager';
export declare class InitCommand implements CLICommand {
    private cli;
    private projectManager;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, projectManager: ProjectManagerImpl, logger: Logger);
    options: ({
        name: string;
        alias: string;
        description: string;
        type: "string";
        required: boolean;
        default?: undefined;
    } | {
        name: string;
        alias: string;
        description: string;
        type: "string";
        default: string;
        required?: undefined;
    })[];
    handler(args: CommandArgs): Promise<void>;
    private getAvailableTemplates;
}
export declare class BuildCommand implements CLICommand {
    private cli;
    private projectManager;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, projectManager: ProjectManagerImpl, logger: Logger);
    options: ({
        name: string;
        alias: string;
        description: string;
        type: "string";
        default: string;
    } | {
        name: string;
        alias: string;
        description: string;
        type: "boolean";
        default: boolean;
    })[];
    handler(args: CommandArgs): Promise<void>;
    private formatFileSize;
}
export declare class DeployCommand implements CLICommand {
    private cli;
    private projectManager;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, projectManager: ProjectManagerImpl, logger: Logger);
    options: ({
        name: string;
        alias: string;
        description: string;
        type: "string";
        required: boolean;
        default?: undefined;
    } | {
        name: string;
        alias: string;
        description: string;
        type: "string";
        default: string;
        required?: undefined;
    } | {
        name: string;
        alias: string;
        description: string;
        type: "boolean";
        default: boolean;
        required?: undefined;
    } | {
        name: string;
        description: string;
        type: "boolean";
        default: boolean;
        alias?: undefined;
        required?: undefined;
    })[];
    handler(args: CommandArgs): Promise<void>;
    private simulateDeployment;
}
export declare class StatusCommand implements CLICommand {
    private cli;
    private projectManager;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, projectManager: ProjectManagerImpl, logger: Logger);
    options: ({
        name: string;
        alias: string;
        description: string;
        type: "string";
        default?: undefined;
    } | {
        name: string;
        alias: string;
        description: string;
        type: "boolean";
        default: boolean;
    })[];
    handler(args: CommandArgs): Promise<void>;
    private showProjectStatus;
    private showAllProjectsStatus;
    private formatDeploymentStatus;
}
export declare class LogsCommand implements CLICommand {
    private cli;
    private deploymentEngine;
    private projectManager;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, deploymentEngine: any, projectManager: ProjectManagerImpl, logger: any);
    options: {
        name: string;
        alias: string;
        description: string;
        type: "string";
    }[];
    handler(args: any): Promise<void>;
}
export declare class RollbackCommand implements CLICommand {
    private cli;
    private deploymentEngine;
    private projectManager;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, deploymentEngine: any, projectManager: ProjectManagerImpl, logger: any);
    options: {
        name: string;
        alias: string;
        description: string;
        type: "string";
        required: boolean;
    }[];
    handler(args: any): Promise<void>;
}
export declare class ConfigCommand implements CLICommand {
    private cli;
    private configManager;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, configManager: any, logger: any);
    options: never[];
    subcommands: {
        name: string;
        description: string;
        options: ({
            name: string;
            description: string;
            type: string;
            required: boolean;
            default?: undefined;
        } | {
            name: string;
            description: string;
            type: string;
            default: string;
            required?: undefined;
        })[];
        handler: (args: any) => Promise<void>;
    }[];
    handler(_: any): Promise<void>;
}
export declare class TemplatesCommand implements CLICommand {
    private cli;
    private projectManager;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, projectManager: ProjectManagerImpl, logger: any);
    options: never[];
    subcommands: {
        name: string;
        description: string;
        options: {
            name: string;
            description: string;
            type: string;
            required: boolean;
        }[];
        handler: (args: any) => Promise<void>;
    }[];
    handler(_: any): Promise<void>;
}
export declare class DeploymentsCommand implements CLICommand {
    private cli;
    private deploymentEngine;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, deploymentEngine: any, logger: any);
    options: {
        name: string;
        alias: string;
        description: string;
        type: "string";
    }[];
    handler(args: any): Promise<void>;
}
export declare class MigrateCommand implements CLICommand {
    private cli;
    private logger;
    name: string;
    description: string;
    constructor(cli: CLIInterface, logger: any);
    options: ({
        name: string;
        alias: string;
        description: string;
        type: "boolean";
        default: boolean;
    } | {
        name: string;
        description: string;
        type: "string";
        alias?: undefined;
        default?: undefined;
    } | {
        name: string;
        description: string;
        type: "boolean";
        default: boolean;
        alias?: undefined;
    })[];
    handler(args: any): Promise<void>;
}
