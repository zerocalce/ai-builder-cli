import { CLICommand, CommandArgs, Logger } from '../types';
import { CLIInterface } from '../cli/interface';
export declare class NavigatorCommand implements CLICommand {
    private cli;
    private logger;
    name: string;
    description: string;
    options: never[];
    constructor(cli: CLIInterface, logger: Logger);
    handler(args: CommandArgs): Promise<void>;
    private processInput;
}
