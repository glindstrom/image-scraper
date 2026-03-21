import { useState, useEffect, useRef } from 'react';
import { getJob } from '../api.js';

export function useJobPoller(jobId) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    function clear() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    async function poll() {
      try {
        const data = await getJob(jobId);
        setJob(data);
        if (data.status === 'done' || data.status === 'error') {
          setLoading(false);
        } else {
          timerRef.current = setTimeout(poll, 1500);
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    poll();
    return clear;
  }, [jobId]);

  return { job, loading, error };
}
