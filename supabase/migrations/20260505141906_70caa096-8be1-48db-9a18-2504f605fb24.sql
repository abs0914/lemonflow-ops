SELECT cron.unschedule('auto-sync-autocount-5min');

SELECT cron.schedule(
  'auto-sync-autocount-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pukezienbcenozlqmunf.supabase.co/functions/v1/auto-sync-to-autocount',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{"source":"cron"}'::jsonb
  ) AS request_id;
  $cron$
);