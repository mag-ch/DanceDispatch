'use client';

import { useEffect, useMemo, useState } from 'react';
import { Host } from '@/lib/utils';

type SelectedHost = { id: string; name: string };

interface HostSelectorProps {
    selectedHostIds: string[];
    onSelectedHostIdsChange: (hostIds: string[]) => void;
    existingHosts?: SelectedHost[];
    maxHeightClassName?: string;
}

export function HostSelector({
    selectedHostIds,
    onSelectedHostIdsChange,
    existingHosts = [],
    maxHeightClassName = 'max-h-64',
}: HostSelectorProps) {
    const [allHosts, setAllHosts] = useState<Host[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newHostTags, setNewHostTags] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadHosts = async () => {
            try {
                const response = await fetch('/api/hosts');
                const data = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(data?.error ?? 'Failed to load hosts');
                }
                if (isMounted) {
                    setAllHosts(Array.isArray(data) ? data : []);
                }
            } catch (loadError) {
                if (isMounted) {
                    setError(loadError instanceof Error ? loadError.message : 'Failed to load hosts');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void loadHosts();
        return () => {
            isMounted = false;
        };
    }, []);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredHosts = useMemo(
        () => allHosts.filter((host) => host.name.toLowerCase().includes(normalizedQuery)),
        [allHosts, normalizedQuery]
    );

    const selectedHostTokens = selectedHostIds
        .map((hostId) => {
            const loadedHost = allHosts.find((host) => String(host.id) === hostId);
            if (loadedHost) {
                return { id: String(loadedHost.id), name: loadedHost.name };
            }
            return existingHosts.find((host) => host.id === hostId) ?? null;
        })
        .filter((host): host is SelectedHost => Boolean(host));

    const toggleHost = (hostId: string) => {
        onSelectedHostIdsChange(
            selectedHostIds.includes(hostId)
                ? selectedHostIds.filter((id) => id !== hostId)
                : [...selectedHostIds, hostId]
        );
        setSearchQuery('');
    };

    const createNewHost = async () => {
        const name = searchQuery.trim();
        if (!name) {
            setError('Host name cannot be empty');
            return;
        }

        try {
            setError(null);
            const response = await fetch('/api/hosts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, tags: newHostTags.trim() }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.error ?? 'Failed to create host');
            }

            setAllHosts((current) => [...current, data as Host]);
            onSelectedHostIdsChange([...selectedHostIds, String(data.id)]);
            setSearchQuery('');
            setNewHostTags('');
            setIsCreating(false);
        } catch (createError) {
            setError(createError instanceof Error ? createError.message : 'Failed to create host');
        }
    };

    return (
        <div className="rounded-lg border border-default p-4">
            <div className="mb-3 w-full rounded-lg border border-default bg-bg px-3 py-2">
                <div className="mb-2 flex flex-wrap gap-2">
                    {selectedHostTokens.map((host) => (
                        <button
                            key={host.id}
                            type="button"
                            onClick={() => toggleHost(host.id)}
                            className="rounded bg-accent px-2 py-1 text-xs font-semibold text-text transition hover:bg-accent-soft"
                        >
                            {host.name} x
                        </button>
                    ))}
                    {selectedHostTokens.length === 0 && (
                        <span className="text-xs text-muted">No hosts selected yet.</span>
                    )}
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search hosts by name"
                    className="w-full bg-transparent text-sm text-text outline-none"
                />
            </div>

            {isLoading && <p className="text-sm text-muted">Loading hosts...</p>}
            {filteredHosts.length > 0 && (
                <div className={`${maxHeightClassName} space-y-2 overflow-y-auto rounded-lg border border-default p-3`}>
                    {filteredHosts.map((host) => {
                        const hostId = String(host.id);
                        return (
                            <label key={hostId} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-accent-soft">
                                <span className="text-sm font-medium text-text">{host.name}</span>
                                <input
                                    type="checkbox"
                                    checked={selectedHostIds.includes(hostId)}
                                    onChange={() => toggleHost(hostId)}
                                    className="h-4 w-4"
                                />
                            </label>
                        );
                    })}
                </div>
            )}

            {normalizedQuery && filteredHosts.length === 0 && (
                <div className="space-y-3">
                    <p className="text-sm text-muted">No hosts match your search.</p>
                    {!isCreating ? (
                        <button
                            type="button"
                            onClick={() => setIsCreating(true)}
                            className="w-full rounded-lg border border-default px-3 py-2 text-sm font-semibold text-text transition hover:bg-accent-soft"
                        >
                            + Create New Host
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={newHostTags}
                                onChange={(event) => setNewHostTags(event.target.value)}
                                placeholder="Enter host tags, comma separated"
                                className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-sm text-text outline-none"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => void createNewHost()}
                                    className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-text transition hover:bg-accent-soft"
                                >
                                    Create
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreating(false);
                                        setNewHostTags('');
                                        setError(null);
                                    }}
                                    className="flex-1 rounded-lg border border-default px-3 py-2 text-sm font-semibold text-text transition hover:bg-accent-soft"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>
    );
}
