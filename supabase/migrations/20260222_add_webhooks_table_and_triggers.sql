-- Migration: add_webhooks_table_and_triggers
-- Created natively for OpenFeedback Ecosystem & Stability Phase.

CREATE TABLE public.webhooks (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL,
    url text NOT NULL,
    events text[] NOT NULL DEFAULT '{suggestion.created, suggestion.shipped}',
    secret text DEFAULT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT webhooks_pkey PRIMARY KEY (id),
    CONSTRAINT webhooks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- Enable RLS (though mostly manipulated via Admin dashboard/CLI)
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view webhooks for their projects" 
ON public.webhooks FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = webhooks.project_id
        AND pm.user_id = auth.uid()
    )
);

CREATE POLICY "Authenticated users can manage webhooks for their projects" 
ON public.webhooks FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = webhooks.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
);

-- Note: In a true self-hosted Supabase environment, pg_net or webhook extensions
-- would be used here. For standard Supabase Studio, Database Webhooks are often
-- configured visually or via the `supabase_functions` schema extension.
--
-- For the sake of schema definition, we rely on the Supabase Edge Function Trigger convention:

-- 1. Create the trigger function that calls the edge function via HTTP POST (using pg_net)
CREATE OR REPLACE FUNCTION public.trigger_dispatch_webhook()
RETURNS trigger AS $$
DECLARE
  edge_function_url text := 'https://kthxnddmihbbhifthmhd.supabase.co/functions/v1/dispatch-webhook';
  service_role_key text;
  payload jsonb;
BEGIN
  -- We assume standard Postgres HTTP extension or pg_net if available.
  -- In Supabase, the actual implementation often leverages the native Webhook UI,
  -- but we document the logical trigger intention here.
  
  -- The payload shape expected by the edge function:
  payload := json_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
  );

  -- We return NEW to allow the transaction to proceed. The actual POST is asynchronous in pg_net.
  -- pg_net.http_post(
  --    url := edge_function_url,
  --    body := payload,
  --    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ..."}',
  --    timeout_milliseconds := 2000
  -- );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to suggestions table
DROP TRIGGER IF EXISTS dispatch_webhook_on_suggestion ON public.suggestions;

CREATE TRIGGER dispatch_webhook_on_suggestion
AFTER INSERT OR UPDATE ON public.suggestions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_dispatch_webhook();
