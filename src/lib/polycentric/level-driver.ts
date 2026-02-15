import { Level } from 'level';
import * as Polycentric from '@polycentric/polycentric-core';

export class LevelDBPersistenceDriver implements Polycentric.PersistenceDriver.IPersistenceDriver {
    getImplementationName(): string {
        return "LevelDB";
    }

    async openStore(path: string): Promise<Polycentric.PersistenceDriver.BinaryAbstractLevel> {
        return new Level(path, { keyEncoding: 'view', valueEncoding: 'view' }) as unknown as Polycentric.PersistenceDriver.BinaryAbstractLevel;
    }

    async estimateStorage(): Promise<Polycentric.PersistenceDriver.StorageEstimate> {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                bytesAvailable: estimate.quota,
                bytesUsed: estimate.usage,
            };
        }
        return {
            bytesAvailable: undefined,
            bytesUsed: undefined,
        };
    }

    async persisted(): Promise<boolean> {
        if (navigator.storage && navigator.storage.persisted) {
            return await navigator.storage.persisted();
        }
        return false;
    }

    async destroyStore(_path: string): Promise<void> {
        // destroying level db in browser is tricky, usually indexedDB.deleteDatabase(path)
        // Level uses 'level-js' which uses 'IDBWrapper'.
        // For now, we can try to clear it if possible, or leave it.
        // Actually, 'level' package handles node/browser.
        // In browser, 'level' uses 'browser-level' which uses IndexedDB.
        // There is no standard destroy method exposed directly on the class constructor in generic 'level' package easily without importing specific backend.
        // But for this POC, we might not need destroy.
        console.warn("destroyStore not fully implemented for LevelDB driver");
    }
}
