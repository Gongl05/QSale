import { useQuery } from '@tanstack/react-query';
import { api } from './session';

export function usePlanData(planId: number) {
  const valid = Number.isSafeInteger(planId) && planId > 0;
  const query = useQuery({
    queryKey: ['plan', planId],
    queryFn: ({ signal }) => api.plan(planId, signal),
    refetchInterval: 8000,
    enabled: valid,
  });
  const enabled = Boolean(query.data);
  const participants = useQuery({
    queryKey: ['participants', planId],
    queryFn: ({ signal }) => api.participants(planId, signal),
    refetchInterval: 8000,
    enabled,
  });
  const commitments = useQuery({
    queryKey: ['commitments', planId],
    queryFn: ({ signal }) => api.commitments(planId, signal),
    refetchInterval: 8000,
    enabled,
  });
  const feasibility = useQuery({
    queryKey: ['feasibility', planId],
    queryFn: ({ signal }) => api.feasibility(planId, signal),
    refetchInterval: 8000,
    enabled,
  });
  const options = useQuery({
    queryKey: ['options', planId],
    queryFn: ({ signal }) => api.options(planId, signal),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.some((option) => option.estimateStatus === 'PENDING') ? 4000 : 8000,
  });
  const availability = useQuery({
    queryKey: ['availabilities', planId],
    queryFn: ({ signal }) => api.availabilities(planId, signal),
    refetchInterval: 8000,
    enabled,
  });
  const geography = useQuery({
    queryKey: ['geography', planId],
    queryFn: ({ signal }) => api.geography(planId, signal),
    refetchInterval: 8000,
    enabled,
  });
  return {
    query,
    participants,
    commitments,
    feasibility,
    options,
    availability,
    geography,
    refresh: () =>
      Promise.all([
        query.refetch(),
        participants.refetch(),
        commitments.refetch(),
        feasibility.refetch(),
        options.refetch(),
        availability.refetch(),
        geography.refetch(),
      ]),
  };
}
