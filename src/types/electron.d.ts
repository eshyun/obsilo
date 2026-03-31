/**
 * Ambient module declaration for 'electron'.
 *
 * Obsidian runs inside Electron, so the module is available at runtime.
 * esbuild treats it as external (see esbuild.config.mjs).
 * We only declare the subset we actually use (safeStorage).
 */
declare module 'electron' {
    interface SafeStorage {
        isEncryptionAvailable(): boolean;
        encryptString(plainText: string): Buffer;
        decryptString(encrypted: Buffer): string;
    }

    const safeStorage: SafeStorage | undefined;
    const remote: { safeStorage?: SafeStorage } | undefined;

    interface GlobalShortcut {
        register(accelerator: string, callback: () => void): boolean;
        unregister(accelerator: string): void;
        unregisterAll(): void;
        isRegistered(accelerator: string): boolean;
    }

    const globalShortcut: GlobalShortcut | undefined;

    export default { safeStorage, remote, globalShortcut };
}
