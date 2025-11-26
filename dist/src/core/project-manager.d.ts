import { Project, ProjectManager, BuildResult, ValidationResult, Logger } from '../types';
export declare class ProjectManagerImpl implements ProjectManager {
    private projectsDir;
    private templatesDir;
    private logger;
    constructor(logger: Logger, dataDir?: string);
    private ensureDirectories;
    createProject(templateName: string, name: string, projectPath: string): Promise<Project>;
    private isValidProjectName;
    private loadTemplate;
    private collectTemplateFiles;
    private promptTemplateVariables;
    private createProjectFiles;
    private saveProjectMetadata;
    buildProject(project: Project): Promise<BuildResult>;
    private installDependencies;
    private executeCommand;
    private collectArtifacts;
    private collectArtifactsRecursive;
    private createHash;
    validateProject(project: Project): Promise<ValidationResult>;
    deleteProject(projectId: string): Promise<void>;
    listProjects(): Promise<Project[]>;
    private getProject;
    loadProject(projectPath: string): Promise<Project>;
}
