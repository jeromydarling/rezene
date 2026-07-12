-- Per-automation "auto-approve": when on, an automation completes its terminal
-- action without waiting for a human — for marketing that means auto-scheduling
-- the drafted posts onto the content calendar (Verto can't post to your socials,
-- but it can fill the calendar); for client/Stripe automations (later waves) it
-- means auto-sending the message / executing the action. Off by default, so
-- nothing goes out on its own unless the shop opts a rule in.

ALTER TABLE automation_settings ADD COLUMN auto_approve INTEGER NOT NULL DEFAULT 0;
