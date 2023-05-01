/**********************************************************************
 * Preflight
**********************************************************************/
GRANT USAGE, CREATE ON SCHEMA public TO public; -- required for running in supabase dashboard

/**********************************************************************
 * Construct schema
 **********************************************************************/
--
-- PostgreSQL database dump
--

-- Dumped from database version 14.1
-- Dumped by pg_dump version 15.1 (Debian 15.1-1.pgdg110+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: audit; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA "audit";


ALTER SCHEMA "audit" OWNER TO "postgres";

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA "public" OWNER TO "postgres";

--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: pgjwt; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: operation; Type: TYPE; Schema: audit; Owner: postgres
--

CREATE TYPE "audit"."operation" AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE'
);


ALTER TYPE "audit"."operation" OWNER TO "postgres";

--
-- Name: disable_tracking("regclass"); Type: FUNCTION; Schema: audit; Owner: postgres
--

CREATE FUNCTION "audit"."disable_tracking"("regclass") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
    statement_row text = format(
        'drop trigger if exists audit_i_u_d on %s;',
        $1
    );

    statement_stmt text = format(
        'drop trigger if exists audit_t on %s;',
        $1
    );
begin
    execute statement_row;
    execute statement_stmt;
end;
$_$;


ALTER FUNCTION "audit"."disable_tracking"("regclass") OWNER TO "postgres";

--
-- Name: enable_tracking("regclass"); Type: FUNCTION; Schema: audit; Owner: postgres
--

CREATE FUNCTION "audit"."enable_tracking"("regclass") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
    statement_row text = format('
        create trigger audit_i_u_d
            after insert or update or delete
            on %s
            for each row
            execute procedure audit.insert_update_delete_trigger();',
        $1
    );

    statement_stmt text = format('
        create trigger audit_t
            after truncate
            on %s
            for each statement
            execute procedure audit.truncate_trigger();',
        $1
    );

    pkey_cols text[] = audit.primary_key_columns($1);
begin
    if pkey_cols = array[]::text[] then
        raise exception 'Table % can not be audited because it has no primary key', $1;
    end if;

    if not exists(select 1 from pg_trigger where tgrelid = $1 and tgname = 'audit_i_u_d') then
        execute statement_row;
    end if;

    if not exists(select 1 from pg_trigger where tgrelid = $1 and tgname = 'audit_t') then
        execute statement_stmt;
    end if;
end;
$_$;


ALTER FUNCTION "audit"."enable_tracking"("regclass") OWNER TO "postgres";

--
-- Name: insert_update_delete_trigger(); Type: FUNCTION; Schema: audit; Owner: postgres
--

CREATE FUNCTION "audit"."insert_update_delete_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    pkey_cols text[] = audit.primary_key_columns(TG_RELID);

    record_jsonb jsonb = to_jsonb(new);
    record_id uuid = audit.to_record_id(TG_RELID, pkey_cols, record_jsonb);

    old_record_jsonb jsonb = to_jsonb(old);
    old_record_id uuid = audit.to_record_id(TG_RELID, pkey_cols, old_record_jsonb);
begin

    insert into audit.record_version(
        record_id,
        old_record_id,
        op,
        table_oid,
        table_schema,
        table_name,
        record,
        old_record
    )
    select
        record_id,
        old_record_id,
        TG_OP::audit.operation,
        TG_RELID,
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        record_jsonb,
        old_record_jsonb;

    return coalesce(new, old);
end;
$$;


ALTER FUNCTION "audit"."insert_update_delete_trigger"() OWNER TO "postgres";

--
-- Name: primary_key_columns("oid"); Type: FUNCTION; Schema: audit; Owner: postgres
--

CREATE FUNCTION "audit"."primary_key_columns"("entity_oid" "oid") RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
    -- Looks up the names of a table's primary key columns
    select
        coalesce(
            array_agg(pa.attname::text order by pa.attnum),
            array[]::text[]
        ) column_names
    from
        pg_index pi
        join pg_attribute pa
            on pi.indrelid = pa.attrelid
            and pa.attnum = any(pi.indkey)

    where
        indrelid = $1
        and indisprimary
$_$;


ALTER FUNCTION "audit"."primary_key_columns"("entity_oid" "oid") OWNER TO "postgres";

--
-- Name: to_record_id("oid", "text"[], "jsonb"); Type: FUNCTION; Schema: audit; Owner: postgres
--

CREATE FUNCTION "audit"."to_record_id"("entity_oid" "oid", "pkey_cols" "text"[], "rec" "jsonb") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $_$
    select
        case
            when rec is null then null
            when pkey_cols = array[]::text[] then extensions.uuid_generate_v4()
            else (
                select
                    extensions.uuid_generate_v5(
                        'fd62bc3d-8d6e-43c2-919c-802ba3762271',
                        ( jsonb_build_array(to_jsonb($1)) || jsonb_agg($3 ->> key_) )::text
                    )
                from
                    unnest($2) x(key_)
            )
        end
$_$;


ALTER FUNCTION "audit"."to_record_id"("entity_oid" "oid", "pkey_cols" "text"[], "rec" "jsonb") OWNER TO "postgres";

--
-- Name: truncate_trigger(); Type: FUNCTION; Schema: audit; Owner: postgres
--

CREATE FUNCTION "audit"."truncate_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    insert into audit.record_version(
        op,
        table_oid,
        table_schema,
        table_name
    )
    select
        TG_OP::audit.operation,
        TG_RELID,
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME;

    return coalesce(old, new);
end;
$$;


ALTER FUNCTION "audit"."truncate_trigger"() OWNER TO "postgres";

--
-- Name: create_organization_if_not_exists_and_user_membership_if_allowe(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."create_organization_if_not_exists_and_user_membership_if_allowe"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_org_id uuid = extensions.uuid_generate_v4();
  personal_email_providers text[] := ARRAY[
    'aol.com', 'comcast.net', 'cox.net', 'gmail.com', 'gmx.com', 'gmx.es', 'gmx.fr', 'gmx.net',
    'hotmail.com', 'icloud.com', 'mac.com', 'mail.com', 'me.com', 'msn.com', 'outlook.com',
    'proton.me', 'protonmail.com', 'verizon.net', 'yahoo.com', 'zohomail.com'
  ];
  user_org_domain text = public.organization_domain_from_email(NEW.email);
  user_org_exists boolean = FALSE;
  user_org_name text = public.organization_default_name_from_email(NEW.email);
  user_role_id uuid;
BEGIN
  IF user_org_domain = ANY(personal_email_providers) THEN
    user_org_domain := NULL;
  ELSE
    user_org_exists := (SELECT COUNT(1) FROM public.organizations WHERE domain = user_org_domain) > 0;
  END IF;
  
  IF NOT user_org_exists THEN
    IF user_org_domain IS NULL OR (SELECT COUNT(1) FROM public.organizations WHERE name = user_org_name) > 0 THEN
      user_org_name := new_org_id::text;
    END IF;
    INSERT INTO public.organizations (
      id,
      name,
      domain
    ) VALUES (
      new_org_id,
      user_org_name,
      user_org_domain -- domain is what's being matched here
    ) ON CONFLICT DO NOTHING; -- user_org_exists should make this redundant
    -- first user is admin
    user_role_id := (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1);
  ELSE
    user_role_id := (SELECT default_role_id FROM public.organizations WHERE name = user_org_name LIMIT 1);
  END IF;

  IF COALESCE((SELECT auto_join_allowed FROM public.organizations WHERE name = user_org_name LIMIT 1), FALSE) THEN
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role_id
    ) VALUES (
      (SELECT id FROM public.organizations WHERE name = user_org_name LIMIT 1),
      NEW.id,
      user_role_id
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NULL;
END
$$;


ALTER FUNCTION "public"."create_organization_if_not_exists_and_user_membership_if_allowe"() OWNER TO "postgres";

--
-- Name: is_member_of("uuid", "uuid", "text"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."is_member_of"("_user_id" "uuid", "_organization_id" "uuid", "role_names" "text"[]) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM 
      public.organization_members om
    WHERE 
      om.organization_id = _organization_id
      AND om.user_id = _user_id
      AND om.deleted_at IS NULL
      AND om.role_id IN (
        SELECT id FROM roles WHERE name = ANY(role_names)
      )
);
$$;


ALTER FUNCTION "public"."is_member_of"("_user_id" "uuid", "_organization_id" "uuid", "role_names" "text"[]) OWNER TO "postgres";

--
-- Name: maintain_edges_history(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."maintain_edges_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.edges_history
    SET system_period = tstzrange(lower(system_period), current_timestamp)
    WHERE 
      system_period @> current_timestamp 
      AND edge_id = NEW.id;

  INSERT INTO public.edges_history (
    system_period,
    edge_id,
    organization_id,
    type_id,
    source_id,
    target_id,
    properties,
    react_flow_meta,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
  )
    VALUES (
      tstzrange(current_timestamp, NULL),
      NEW.id,
      NEW.organization_id,
      NEW.type_id,
      NEW.source_id,
      NEW.target_id,
      NEW.properties,
      NEW.react_flow_meta,
      NEW.created_at,
      NEW.created_by,
      NEW.updated_at,
      NEW.updated_by,
      NEW.deleted_at,
      NEW.deleted_by
    );

  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."maintain_edges_history"() OWNER TO "postgres";

--
-- Name: maintain_nodes_history(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."maintain_nodes_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.nodes_history
    SET system_period = tstzrange(lower(system_period), current_timestamp)
    WHERE 
      system_period @> current_timestamp 
      AND node_id = NEW.id;

  INSERT INTO public.nodes_history (
    system_period,
    node_id,
    organization_id,
    type_id,
    properties,
    react_flow_meta,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
  )
    VALUES (
      tstzrange(current_timestamp, NULL),
      NEW.id,
      NEW.organization_id,
      NEW.type_id,
      NEW.properties,
      NEW.react_flow_meta,
      NEW.created_at,
      NEW.created_by,
      NEW.updated_at,
      NEW.updated_by,
      NEW.deleted_at,
      NEW.deleted_by
    );

  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."maintain_nodes_history"() OWNER TO "postgres";

--
-- Name: organization_default_name_from_email("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."organization_default_name_from_email"("email" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
      RETURN SPLIT_PART(SPLIT_PART(email, '@', 2), '.', 1);
    END;
$$;


ALTER FUNCTION "public"."organization_default_name_from_email"("email" "text") OWNER TO "postgres";

--
-- Name: organization_domain_from_email("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."organization_domain_from_email"("email" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
      RETURN SPLIT_PART(email, '@', 2);
    END;
$$;


ALTER FUNCTION "public"."organization_domain_from_email"("email" "text") OWNER TO "postgres";

--
-- Name: sync_user_records(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."sync_user_records"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.users (
      id,
      email,
      phone,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data
    )
    VALUES (
      NEW.id,
      NEW.email,
      NEW.phone,
      NEW.last_sign_in_at,
      NEW.raw_app_meta_data,
      NEW.raw_user_meta_data
    ) 
    ON CONFLICT (id) DO UPDATE SET
      id = NEW.id,
      email = NEW.email,
      phone = NEW.phone,
      last_sign_in_at = NEW.last_sign_in_at,
      raw_app_meta_data = NEW.raw_app_meta_data,
      raw_user_meta_data = NEW.raw_user_meta_data,
      updated_at = NOW();
    RETURN NULL;
END
$$;


ALTER FUNCTION "public"."sync_user_records"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: record_version; Type: TABLE; Schema: audit; Owner: postgres
--

CREATE TABLE "audit"."record_version" (
    "id" bigint NOT NULL,
    "record_id" "uuid",
    "old_record_id" "uuid",
    "op" "audit"."operation" NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL,
    "table_oid" "oid" NOT NULL,
    "table_schema" "name" NOT NULL,
    "table_name" "name" NOT NULL,
    "record" "jsonb",
    "old_record" "jsonb",
    "auth_uid" "uuid" DEFAULT "auth"."uid"(),
    "auth_role" "text" DEFAULT "auth"."role"(),
    CONSTRAINT "record_version_check" CHECK (((COALESCE("record_id", "old_record_id") IS NOT NULL) OR ("op" = 'TRUNCATE'::"audit"."operation"))),
    CONSTRAINT "record_version_check1" CHECK ((("op" = ANY (ARRAY['INSERT'::"audit"."operation", 'UPDATE'::"audit"."operation"])) = ("record_id" IS NOT NULL))),
    CONSTRAINT "record_version_check2" CHECK ((("op" = ANY (ARRAY['INSERT'::"audit"."operation", 'UPDATE'::"audit"."operation"])) = ("record" IS NOT NULL))),
    CONSTRAINT "record_version_check3" CHECK ((("op" = ANY (ARRAY['UPDATE'::"audit"."operation", 'DELETE'::"audit"."operation"])) = ("old_record_id" IS NOT NULL))),
    CONSTRAINT "record_version_check4" CHECK ((("op" = ANY (ARRAY['UPDATE'::"audit"."operation", 'DELETE'::"audit"."operation"])) = ("old_record" IS NOT NULL)))
);


ALTER TABLE "audit"."record_version" OWNER TO "postgres";

--
-- Name: record_version_id_seq; Type: SEQUENCE; Schema: audit; Owner: postgres
--

CREATE SEQUENCE "audit"."record_version_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "audit"."record_version_id_seq" OWNER TO "postgres";

--
-- Name: record_version_id_seq; Type: SEQUENCE OWNED BY; Schema: audit; Owner: postgres
--

ALTER SEQUENCE "audit"."record_version_id_seq" OWNED BY "audit"."record_version"."id";


--
-- Name: goals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."goals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "parent_node_id" "uuid",
    "name" "text",
    "properties" "json",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."goals" OWNER TO "postgres";

--
-- Name: columnar_goals; Type: VIEW; Schema: public; Owner: authenticated
--

CREATE VIEW "public"."columnar_goals" AS
 SELECT "goals"."id",
    "goals"."organization_id",
    "goals"."parent_node_id",
    "goals"."name",
    "goals"."properties",
    "goals"."created_at",
    "goals"."updated_at",
    "goals"."deleted_at",
    ("goals"."properties" ->> 'owner'::"text") AS "owner",
    ("goals"."properties" ->> 'description'::"text") AS "description",
    ("goals"."properties" ->> 'type'::"text") AS "type",
    (("goals"."properties" -> 'dimension'::"text") ->> 'name'::"text") AS "dimension_name",
    (("goals"."properties" -> 'dimension'::"text") ->> 'value'::"text") AS "dimension_value",
    ("goals"."properties" ->> 'frequency'::"text") AS "frequency",
    ("goals"."properties" -> 'values'::"text") AS "values",
    ((("goals"."properties" -> 'values'::"text") -> 0) ->> 'date'::"text") AS "first_date",
    ((("goals"."properties" -> 'values'::"text") -> '-1'::integer) ->> 'date'::"text") AS "last_date"
   FROM "public"."goals";


ALTER TABLE "public"."columnar_goals" OWNER TO "authenticated";

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "topic_id" "text" NOT NULL,
    "parent_id" "uuid",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."comments" OWNER TO "postgres";

--
-- Name: database_connection_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."database_connection_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."database_connection_types" OWNER TO "postgres";

--
-- Name: database_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."database_connections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "type_id" "uuid",
    "name" "text" NOT NULL,
    "encrypted_credentials" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."database_connections" OWNER TO "postgres";

--
-- Name: database_queries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."database_queries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "database_connection_id" "uuid",
    "parent_node_id" "uuid",
    "statement" "text" NOT NULL,
    "result_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."database_queries" OWNER TO "postgres";

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."users" (
    "id" "uuid" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "email" character varying,
    "phone" character varying,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb"
);


ALTER TABLE "public"."users" OWNER TO "postgres";

--
-- Name: display_users; Type: VIEW; Schema: public; Owner: authenticated
--

CREATE VIEW "public"."display_users" AS
 SELECT "users"."id",
    COALESCE(("users"."raw_user_meta_data" ->> 'name'::"text"), ("users"."raw_user_meta_data" ->> 'full_name'::"text"), ("users"."raw_user_meta_data" ->> 'user_name'::"text")) AS "name",
    COALESCE(("users"."raw_user_meta_data" ->> 'avatar_url'::"text"), ("users"."raw_user_meta_data" ->> 'avatar'::"text")) AS "avatar_url",
    "users"."email"
   FROM "public"."users";


ALTER TABLE "public"."display_users" OWNER TO "authenticated";

--
-- Name: edge_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."edge_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."edge_types" OWNER TO "postgres";

--
-- Name: edges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."edges" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "type_id" "uuid" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "properties" "json" NOT NULL,
    "react_flow_meta" "json" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid"
);


ALTER TABLE "public"."edges" OWNER TO "postgres";

--
-- Name: edges_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."edges_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "system_period" "tstzrange" NOT NULL,
    "edge_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "type_id" "uuid" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "properties" "json" NOT NULL,
    "react_flow_meta" "json" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid"
);


ALTER TABLE "public"."edges_history" OWNER TO "postgres";

--
-- Name: function_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."function_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "symbol" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."function_types" OWNER TO "postgres";

--
-- Name: graph_sync_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."graph_sync_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."graph_sync_types" OWNER TO "postgres";

--
-- Name: graph_syncs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."graph_syncs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "type_id" "uuid",
    "name" "text" NOT NULL,
    "encrypted_credentials" "text",
    "properties" "json",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."graph_syncs" OWNER TO "postgres";

--
-- Name: input_parameters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."input_parameters" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "value" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."input_parameters" OWNER TO "postgres";

--
-- Name: monitoring_rule_evaluations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."monitoring_rule_evaluations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "monitoring_rule_id" "uuid",
    "status" "text",
    "alerts" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."monitoring_rule_evaluations" OWNER TO "postgres";

--
-- Name: monitoring_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."monitoring_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text",
    "organization_id" "uuid",
    "parent_node_id" "uuid",
    "properties" "json",
    "schedule" "text" NOT NULL,
    "slack_to" "text",
    "email_to" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."monitoring_rules" OWNER TO "postgres";

--
-- Name: latest_monitoring_rule_evaluations; Type: VIEW; Schema: public; Owner: authenticated
--

CREATE VIEW "public"."latest_monitoring_rule_evaluations" AS
 SELECT "mre"."id",
    "mre"."monitoring_rule_id",
    "mre"."status",
    "mre"."alerts",
    "mre"."created_at",
    "mre"."updated_at",
    "mre"."deleted_at",
    "mr"."organization_id"
   FROM (("public"."monitoring_rule_evaluations" "mre"
     JOIN ( SELECT "monitoring_rule_evaluations"."monitoring_rule_id",
            "max"("monitoring_rule_evaluations"."updated_at") AS "updated_at"
           FROM "public"."monitoring_rule_evaluations"
          GROUP BY "monitoring_rule_evaluations"."monitoring_rule_id") "last_updated_at" USING ("monitoring_rule_id", "updated_at"))
     JOIN "public"."monitoring_rules" "mr" ON (("mr"."id" = "mre"."monitoring_rule_id")));


ALTER TABLE "public"."latest_monitoring_rule_evaluations" OWNER TO "authenticated";

--
-- Name: node_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."node_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."node_types" OWNER TO "postgres";

--
-- Name: nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."nodes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "type_id" "uuid" NOT NULL,
    "properties" "json" NOT NULL,
    "react_flow_meta" "json" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid"
);


ALTER TABLE "public"."nodes" OWNER TO "postgres";

--
-- Name: nodes_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."nodes_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "system_period" "tstzrange" NOT NULL,
    "node_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "type_id" "uuid" NOT NULL,
    "properties" "json" NOT NULL,
    "react_flow_meta" "json" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid"
);


ALTER TABLE "public"."nodes_history" OWNER TO "postgres";

--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."organization_members" (
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text",
    "domain" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "auto_join_allowed" boolean DEFAULT true,
    "enabled" boolean DEFAULT true,
    "default_role_id" "uuid" DEFAULT '26829f0c-ccc9-4964-879b-4e787db0fc3a'::"uuid" NOT NULL,
    "logo_storage_path" "text",
    "query_dimensions" "text" DEFAULT 'NULL'::"text",
    "query_frequencies" "text" DEFAULT 'SECOND,MINUTE,HOUR,DAY,WEEK,MONTH,QUARTER,YEAR'::"text"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";

--
-- Name: refresh_job_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."refresh_job_runs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "refresh_job_id" "uuid",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."refresh_job_runs" OWNER TO "postgres";

--
-- Name: refresh_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."refresh_jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "schedule" "text",
    "email_to" "text",
    "slack_to" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "name" "text"
);


ALTER TABLE "public"."refresh_jobs" OWNER TO "postgres";

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "level" double precision
);


ALTER TABLE "public"."roles" OWNER TO "postgres";

--
-- Name: record_version id; Type: DEFAULT; Schema: audit; Owner: postgres
--

ALTER TABLE ONLY "audit"."record_version" ALTER COLUMN "id" SET DEFAULT "nextval"('"audit"."record_version_id_seq"'::"regclass");


--
-- Name: record_version record_version_pkey; Type: CONSTRAINT; Schema: audit; Owner: postgres
--

ALTER TABLE ONLY "audit"."record_version"
    ADD CONSTRAINT "record_version_pkey" PRIMARY KEY ("id");


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");


--
-- Name: database_connection_types database_connection_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."database_connection_types"
    ADD CONSTRAINT "database_connection_types_pkey" PRIMARY KEY ("id");


--
-- Name: database_connections database_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."database_connections"
    ADD CONSTRAINT "database_connections_pkey" PRIMARY KEY ("id");


--
-- Name: database_queries database_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."database_queries"
    ADD CONSTRAINT "database_queries_pkey" PRIMARY KEY ("id");


--
-- Name: input_parameters database_query_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."input_parameters"
    ADD CONSTRAINT "database_query_parameters_pkey" PRIMARY KEY ("id");


--
-- Name: edge_types edge_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edge_types"
    ADD CONSTRAINT "edge_types_name_key" UNIQUE ("name");


--
-- Name: edge_types edge_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edge_types"
    ADD CONSTRAINT "edge_types_pkey" PRIMARY KEY ("id");


--
-- Name: edges_history edges_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges_history"
    ADD CONSTRAINT "edges_history_pkey" PRIMARY KEY ("id");


--
-- Name: edges edges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_pkey" PRIMARY KEY ("id");


--
-- Name: function_types function_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."function_types"
    ADD CONSTRAINT "function_types_pkey" PRIMARY KEY ("id");


--
-- Name: function_types function_types_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."function_types"
    ADD CONSTRAINT "function_types_types_name_key" UNIQUE ("name");


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");


--
-- Name: graph_sync_types graph_sync_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."graph_sync_types"
    ADD CONSTRAINT "graph_sync_types_pkey" PRIMARY KEY ("id");


--
-- Name: graph_syncs graph_syncs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."graph_syncs"
    ADD CONSTRAINT "graph_syncs_pkey" PRIMARY KEY ("id");


--
-- Name: monitoring_rule_evaluations monitoring_rule_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."monitoring_rule_evaluations"
    ADD CONSTRAINT "monitoring_rule_evaluations_pkey" PRIMARY KEY ("id");


--
-- Name: monitoring_rules monitoring_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."monitoring_rules"
    ADD CONSTRAINT "monitoring_rules_pkey" PRIMARY KEY ("id");


--
-- Name: node_types node_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."node_types"
    ADD CONSTRAINT "node_types_name_key" UNIQUE ("name");


--
-- Name: node_types node_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."node_types"
    ADD CONSTRAINT "node_types_pkey" PRIMARY KEY ("id");


--
-- Name: nodes_history nodes_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes_history"
    ADD CONSTRAINT "nodes_history_pkey" PRIMARY KEY ("id");


--
-- Name: nodes nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_pkey" PRIMARY KEY ("id");


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id", "user_id");


--
-- Name: organizations organizations_domain_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_domain_key" UNIQUE ("domain");


--
-- Name: organizations organizations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_name_key" UNIQUE ("name");


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");


--
-- Name: refresh_job_runs refresh_job_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refresh_job_runs"
    ADD CONSTRAINT "refresh_job_runs_pkey" PRIMARY KEY ("id");


--
-- Name: refresh_jobs refresh_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refresh_jobs"
    ADD CONSTRAINT "refresh_jobs_pkey" PRIMARY KEY ("id");


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: record_version_old_record_id; Type: INDEX; Schema: audit; Owner: postgres
--

CREATE INDEX "record_version_old_record_id" ON "audit"."record_version" USING "btree" ("old_record_id") WHERE ("old_record_id" IS NOT NULL);


--
-- Name: record_version_record_id; Type: INDEX; Schema: audit; Owner: postgres
--

CREATE INDEX "record_version_record_id" ON "audit"."record_version" USING "btree" ("record_id") WHERE ("record_id" IS NOT NULL);


--
-- Name: record_version_table_oid; Type: INDEX; Schema: audit; Owner: postgres
--

CREATE INDEX "record_version_table_oid" ON "audit"."record_version" USING "btree" ("table_oid");


--
-- Name: record_version_ts; Type: INDEX; Schema: audit; Owner: postgres
--

CREATE INDEX "record_version_ts" ON "audit"."record_version" USING "brin" ("ts");


--
-- Name: comments_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "comments_parent_id" ON "public"."comments" USING "btree" ("parent_id");


--
-- Name: comments_topic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "comments_topic_id" ON "public"."comments" USING "btree" ("topic_id");


--
-- Name: database_connections_organization_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "database_connections_organization_id_index" ON "public"."database_connections" USING "btree" ("organization_id");


--
-- Name: database_queries_database_connection_id_parent_node_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "database_queries_database_connection_id_parent_node_id" ON "public"."database_queries" USING "btree" ("database_connection_id", "parent_node_id");


--
-- Name: database_queries_database_connection_id_parent_node_id_statemen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "database_queries_database_connection_id_parent_node_id_statemen" ON "public"."database_queries" USING "btree" ("database_connection_id", "parent_node_id", "statement");


--
-- Name: edges_organization_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "edges_organization_id_index" ON "public"."edges" USING "btree" ("organization_id");


--
-- Name: monitoring_rule_evaluations_monitoring_rule_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "monitoring_rule_evaluations_monitoring_rule_id" ON "public"."monitoring_rule_evaluations" USING "btree" ("monitoring_rule_id");


--
-- Name: monitoring_rules_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "monitoring_rules_organization_id" ON "public"."monitoring_rules" USING "btree" ("organization_id");


--
-- Name: nodes_organization_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "nodes_organization_id_index" ON "public"."nodes" USING "btree" ("organization_id");


--
-- Name: organization_members_organization_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "organization_members_organization_id_index" ON "public"."organization_members" USING "btree" ("organization_id");


--
-- Name: organization_members_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "organization_members_user_id_index" ON "public"."organization_members" USING "btree" ("user_id");


--
-- Name: refresh_job_runs_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "refresh_job_runs_deleted_at_index" ON "public"."refresh_jobs" USING "btree" ("deleted_at");


--
-- Name: refresh_job_runs_deleted_at_organization_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "refresh_job_runs_deleted_at_organization_id_index" ON "public"."refresh_jobs" USING "btree" ("deleted_at", "organization_id");


--
-- Name: refresh_job_runs_status_created_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "refresh_job_runs_status_created_at_index" ON "public"."refresh_job_runs" USING "btree" ("status", "created_at");


--
-- Name: comments audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: database_connection_types audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."database_connection_types" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: database_connections audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."database_connections" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: database_queries audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."database_queries" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: edge_types audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."edge_types" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: edges audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."edges" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: function_types audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."function_types" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: goals audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: graph_sync_types audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."graph_sync_types" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: graph_syncs audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."graph_syncs" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: input_parameters audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."input_parameters" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: monitoring_rule_evaluations audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."monitoring_rule_evaluations" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: monitoring_rules audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."monitoring_rules" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: node_types audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."node_types" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: nodes audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."nodes" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: organization_members audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: organizations audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: refresh_job_runs audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."refresh_job_runs" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: refresh_jobs audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."refresh_jobs" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: roles audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: users audit_i_u_d; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_i_u_d" AFTER INSERT OR DELETE OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "audit"."insert_update_delete_trigger"();


--
-- Name: comments audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."comments" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: database_connection_types audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."database_connection_types" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: database_connections audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."database_connections" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: database_queries audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."database_queries" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: edge_types audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."edge_types" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: edges audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."edges" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: function_types audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."function_types" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: goals audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."goals" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: graph_sync_types audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."graph_sync_types" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: graph_syncs audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."graph_syncs" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: input_parameters audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."input_parameters" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: monitoring_rule_evaluations audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."monitoring_rule_evaluations" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: monitoring_rules audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."monitoring_rules" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: node_types audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."node_types" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: nodes audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."nodes" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: organization_members audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."organization_members" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: organizations audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."organizations" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: refresh_job_runs audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."refresh_job_runs" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: refresh_jobs audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."refresh_jobs" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: roles audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."roles" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: users audit_t; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_t" AFTER TRUNCATE ON "public"."users" FOR EACH STATEMENT EXECUTE FUNCTION "audit"."truncate_trigger"();


--
-- Name: users create_organization_if_not_exists_and_user_membership_if_allowe; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "create_organization_if_not_exists_and_user_membership_if_allowe" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."create_organization_if_not_exists_and_user_membership_if_allowe"();


--
-- Name: edges maintain_edges_history_upon_insert_or_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "maintain_edges_history_upon_insert_or_update" AFTER INSERT OR UPDATE ON "public"."edges" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_edges_history"();


--
-- Name: nodes maintain_nodes_history_upon_insert_or_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "maintain_nodes_history_upon_insert_or_update" AFTER INSERT OR UPDATE ON "public"."nodes" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_nodes_history"();

--
-- Name: users sync_user_records_upon_signup_or_update; Type: TRIGGER; Schema: auth; Owner: postgres
--

CREATE TRIGGER "sync_user_records_upon_signup_or_update" AFTER INSERT OR UPDATE ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_records"();


--
-- Name: comments comments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id");


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");


--
-- Name: database_connections database_connections_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."database_connections"
    ADD CONSTRAINT "database_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: database_connections database_connections_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."database_connections"
    ADD CONSTRAINT "database_connections_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."database_connection_types"("id");


--
-- Name: database_queries database_queries_database_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."database_queries"
    ADD CONSTRAINT "database_queries_database_connection_id_fkey" FOREIGN KEY ("database_connection_id") REFERENCES "public"."database_connections"("id");


--
-- Name: database_queries database_queries_parent_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."database_queries"
    ADD CONSTRAINT "database_queries_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "public"."nodes"("id");


--
-- Name: input_parameters database_query_parameters_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."input_parameters"
    ADD CONSTRAINT "database_query_parameters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: input_parameters database_query_parameters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."input_parameters"
    ADD CONSTRAINT "database_query_parameters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");


--
-- Name: edges edges_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");


--
-- Name: edges edges_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");


--
-- Name: edges_history edges_history_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges_history"
    ADD CONSTRAINT "edges_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");


--
-- Name: edges_history edges_history_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges_history"
    ADD CONSTRAINT "edges_history_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");


--
-- Name: edges_history edges_history_edge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges_history"
    ADD CONSTRAINT "edges_history_edge_id_fkey" FOREIGN KEY ("edge_id") REFERENCES "public"."edges"("id");


--
-- Name: edges_history edges_history_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges_history"
    ADD CONSTRAINT "edges_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: edges_history edges_history_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges_history"
    ADD CONSTRAINT "edges_history_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."nodes"("id");


--
-- Name: edges_history edges_history_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges_history"
    ADD CONSTRAINT "edges_history_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."nodes"("id");


--
-- Name: edges_history edges_history_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges_history"
    ADD CONSTRAINT "edges_history_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."edge_types"("id");


--
-- Name: edges_history edges_history_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges_history"
    ADD CONSTRAINT "edges_history_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");


--
-- Name: edges edges_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: edges edges_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."nodes"("id");


--
-- Name: edges edges_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."nodes"("id");


--
-- Name: edges edges_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."edge_types"("id");


--
-- Name: edges edges_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");


--
-- Name: goals goals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: goals goals_parent_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "public"."nodes"("id");


--
-- Name: graph_syncs graph_syncs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."graph_syncs"
    ADD CONSTRAINT "graph_syncs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: graph_syncs graph_syncs_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."graph_syncs"
    ADD CONSTRAINT "graph_syncs_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."graph_sync_types"("id");


--
-- Name: monitoring_rule_evaluations monitoring_rule_evaluations_monitoring_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."monitoring_rule_evaluations"
    ADD CONSTRAINT "monitoring_rule_evaluations_monitoring_rule_id_fkey" FOREIGN KEY ("monitoring_rule_id") REFERENCES "public"."monitoring_rules"("id");


--
-- Name: monitoring_rules monitoring_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."monitoring_rules"
    ADD CONSTRAINT "monitoring_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: monitoring_rules monitoring_rules_parent_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."monitoring_rules"
    ADD CONSTRAINT "monitoring_rules_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "public"."nodes"("id");


--
-- Name: nodes nodes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");


--
-- Name: nodes nodes_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");


--
-- Name: nodes_history nodes_history_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes_history"
    ADD CONSTRAINT "nodes_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");


--
-- Name: nodes_history nodes_history_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes_history"
    ADD CONSTRAINT "nodes_history_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");


--
-- Name: nodes_history nodes_history_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes_history"
    ADD CONSTRAINT "nodes_history_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id");


--
-- Name: nodes_history nodes_history_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes_history"
    ADD CONSTRAINT "nodes_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: nodes_history nodes_history_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes_history"
    ADD CONSTRAINT "nodes_history_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."node_types"("id");


--
-- Name: nodes_history nodes_history_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes_history"
    ADD CONSTRAINT "nodes_history_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");


--
-- Name: nodes nodes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: nodes nodes_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."node_types"("id");


--
-- Name: nodes nodes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: organization_members organization_members_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");


--
-- Name: organizations organizations_default_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_default_role_id_fkey" FOREIGN KEY ("default_role_id") REFERENCES "public"."roles"("id");


--
-- Name: refresh_job_runs refresh_job_runs_refresh_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refresh_job_runs"
    ADD CONSTRAINT "refresh_job_runs_refresh_job_id_fkey" FOREIGN KEY ("refresh_job_id") REFERENCES "public"."refresh_jobs"("id");


--
-- Name: refresh_jobs refresh_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."refresh_jobs"
    ADD CONSTRAINT "refresh_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");


--
-- Name: graph_syncs If they're an admin of some org, users can select records whose; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "If they're an admin of some org, users can select records whose" ON "public"."graph_syncs" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON ((("r"."id" = "om"."role_id") AND ("r"."name" = 'admin'::"text"))))
  WHERE ("om"."user_id" = "auth"."uid"()))) AND (("organization_id" IS NULL) AND (("created_at" >= ("now"() - '00:01:00'::interval)) AND ("created_at" <= "now"())))));


--
-- Name: graph_syncs If they're an admin of some org, users can update records whose; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "If they're an admin of some org, users can update records whose" ON "public"."graph_syncs" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON ((("r"."id" = "om"."role_id") AND ("r"."name" = 'admin'::"text"))))
  WHERE ("om"."user_id" = "auth"."uid"()))) AND (("organization_id" IS NULL) AND (("created_at" >= ("now"() - '00:01:00'::interval)) AND ("created_at" <= "now"())))));


--
-- Name: edges Records cannot be deleted.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Records cannot be deleted." ON "public"."edges" FOR DELETE USING (false);


--
-- Name: nodes Records cannot be deleted.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Records cannot be deleted." ON "public"."nodes" FOR DELETE USING (false);


--
-- Name: input_parameters Users can insert org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert org-wide records of organizations they're admi" ON "public"."input_parameters" FOR INSERT WITH CHECK (("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]) AND ("user_id" IS NULL)));


--
-- Name: monitoring_rule_evaluations Users can insert org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert org-wide records of organizations they're admi" ON "public"."monitoring_rule_evaluations" FOR INSERT WITH CHECK (("monitoring_rule_id" IN ( SELECT "monitoring_rules"."id"
   FROM "public"."monitoring_rules"
  WHERE "public"."is_member_of"("auth"."uid"(), "monitoring_rules"."organization_id", ARRAY['admin'::"text"]))));


--
-- Name: refresh_job_runs Users can insert org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert org-wide records of organizations they're admi" ON "public"."refresh_job_runs" FOR INSERT WITH CHECK (("refresh_job_id" IN ( SELECT "refresh_jobs"."id"
   FROM "public"."refresh_jobs"
  WHERE "public"."is_member_of"("auth"."uid"(), "refresh_jobs"."organization_id", ARRAY['admin'::"text"]))));


--
-- Name: refresh_jobs Users can insert org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert org-wide records of organizations they're admi" ON "public"."refresh_jobs" FOR INSERT WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: input_parameters Users can insert own records within organizations they're membe; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own records within organizations they're membe" ON "public"."input_parameters" FOR INSERT WITH CHECK (("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]) AND ("user_id" = "auth"."uid"())));


--
-- Name: database_connections Users can insert records of organizations they're admins of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert records of organizations they're admins of." ON "public"."database_connections" FOR INSERT WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: graph_syncs Users can insert records of organizations they're admins of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert records of organizations they're admins of." ON "public"."graph_syncs" FOR INSERT WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: edges Users can insert records of organizations they're admins or edi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert records of organizations they're admins or edi" ON "public"."edges" FOR INSERT WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: nodes Users can insert records of organizations they're admins or edi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert records of organizations they're admins or edi" ON "public"."nodes" FOR INSERT WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: goals Users can insert records of organizations they're editors of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert records of organizations they're editors of." ON "public"."goals" FOR INSERT WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: monitoring_rules Users can insert records of organizations they're editors of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert records of organizations they're editors of." ON "public"."monitoring_rules" FOR INSERT WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: comments Users can insert records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert records of organizations they're members of." ON "public"."comments" FOR INSERT WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: database_queries Users can insert records of their orgs' connections.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert records of their orgs' connections." ON "public"."database_queries" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."database_connections"
  WHERE ("public"."is_member_of"("auth"."uid"(), "database_connections"."organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]) AND ("database_connections"."deleted_at" IS NULL) AND ("database_connections"."id" = "database_queries"."database_connection_id")))));


--
-- Name: input_parameters Users can select org-wide records of organizations they're memb; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select org-wide records of organizations they're memb" ON "public"."input_parameters" FOR SELECT USING (("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]) AND ("user_id" IS NULL)));


--
-- Name: monitoring_rule_evaluations Users can select org-wide records of organizations they're memb; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select org-wide records of organizations they're memb" ON "public"."monitoring_rule_evaluations" FOR SELECT USING (("monitoring_rule_id" IN ( SELECT "monitoring_rules"."id"
   FROM "public"."monitoring_rules"
  WHERE "public"."is_member_of"("auth"."uid"(), "monitoring_rules"."organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]))));


--
-- Name: refresh_job_runs Users can select org-wide records of organizations they're memb; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select org-wide records of organizations they're memb" ON "public"."refresh_job_runs" FOR SELECT USING (("refresh_job_id" IN ( SELECT "refresh_jobs"."id"
   FROM "public"."refresh_jobs"
  WHERE "public"."is_member_of"("auth"."uid"(), "refresh_jobs"."organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]))));


--
-- Name: refresh_jobs Users can select org-wide records of organizations they're memb; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select org-wide records of organizations they're memb" ON "public"."refresh_jobs" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: input_parameters Users can select own records within organizations they're membe; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select own records within organizations they're membe" ON "public"."input_parameters" FOR SELECT USING (("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]) AND ("user_id" = "auth"."uid"())));


--
-- Name: organization_members Users can select own records.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select own records." ON "public"."organization_members" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: users Users can select own records.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select own records." ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));


--
-- Name: organizations Users can select records for organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records for organizations they're members of." ON "public"."organizations" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text", 'awaiting_admin_approval'::"text"]));


--
-- Name: comments Users can select records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of organizations they're members of." ON "public"."comments" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: database_connections Users can select records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of organizations they're members of." ON "public"."database_connections" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: edges Users can select records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of organizations they're members of." ON "public"."edges" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: edges_history Users can select records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of organizations they're members of." ON "public"."edges_history" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: goals Users can select records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of organizations they're members of." ON "public"."goals" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: graph_syncs Users can select records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of organizations they're members of." ON "public"."graph_syncs" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: monitoring_rules Users can select records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of organizations they're members of." ON "public"."monitoring_rules" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: nodes Users can select records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of organizations they're members of." ON "public"."nodes" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: nodes_history Users can select records of organizations they're members of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of organizations they're members of." ON "public"."nodes_history" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: organization_members Users can select records of same-org users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of same-org users" ON "public"."organization_members" FOR SELECT USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]));


--
-- Name: users Users can select records of same-org users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of same-org users" ON "public"."users" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "target_user_om"
  WHERE ("public"."is_member_of"("auth"."uid"(), "target_user_om"."organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]) AND ("target_user_om"."user_id" = "users"."id") AND ("target_user_om"."deleted_at" IS NULL)))));


--
-- Name: database_queries Users can select records of their orgs' connections.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select records of their orgs' connections." ON "public"."database_queries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."database_connections"
  WHERE ("public"."is_member_of"("auth"."uid"(), "database_connections"."organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]) AND ("database_connections"."deleted_at" IS NULL) AND ("database_connections"."id" = "database_queries"."database_connection_id")))));


--
-- Name: input_parameters Users can update org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update org-wide records of organizations they're admi" ON "public"."input_parameters" FOR UPDATE USING (("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]) AND ("user_id" IS NULL)));


--
-- Name: monitoring_rule_evaluations Users can update org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update org-wide records of organizations they're admi" ON "public"."monitoring_rule_evaluations" FOR UPDATE USING (("monitoring_rule_id" IN ( SELECT "monitoring_rules"."id"
   FROM "public"."monitoring_rules"
  WHERE "public"."is_member_of"("auth"."uid"(), "monitoring_rules"."organization_id", ARRAY['admin'::"text"]))));


--
-- Name: refresh_job_runs Users can update org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update org-wide records of organizations they're admi" ON "public"."refresh_job_runs" FOR UPDATE USING (("refresh_job_id" IN ( SELECT "refresh_jobs"."id"
   FROM "public"."refresh_jobs"
  WHERE "public"."is_member_of"("auth"."uid"(), "refresh_jobs"."organization_id", ARRAY['admin'::"text"]))));


--
-- Name: refresh_jobs Users can update org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update org-wide records of organizations they're admi" ON "public"."refresh_jobs" FOR UPDATE USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: input_parameters Users can update own records within organizations they're membe; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own records within organizations they're membe" ON "public"."input_parameters" FOR UPDATE USING (("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]) AND ("user_id" = "auth"."uid"())));


--
-- Name: comments Users can update own records.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own records." ON "public"."comments" FOR UPDATE USING (("user_id" = "auth"."uid"()));


--
-- Name: users Users can update own records.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own records." ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));


--
-- Name: database_connections Users can update records of organizations they're admins of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update records of organizations they're admins of." ON "public"."database_connections" FOR UPDATE USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: graph_syncs Users can update records of organizations they're admins of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update records of organizations they're admins of." ON "public"."graph_syncs" FOR UPDATE USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: edges Users can update records of organizations they're admins or edi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update records of organizations they're admins or edi" ON "public"."edges" FOR UPDATE USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: nodes Users can update records of organizations they're admins or edi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update records of organizations they're admins or edi" ON "public"."nodes" FOR UPDATE USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: goals Users can update records of organizations they're editors of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update records of organizations they're editors of." ON "public"."goals" FOR UPDATE USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: monitoring_rules Users can update records of organizations they're editors of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update records of organizations they're editors of." ON "public"."monitoring_rules" FOR UPDATE USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: organization_members Users can update records of orgs they're admins of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update records of orgs they're admins of." ON "public"."organization_members" FOR UPDATE USING ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: organizations Users can update records of orgs they're admins of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update records of orgs they're admins of." ON "public"."organizations" FOR UPDATE USING ("public"."is_member_of"("auth"."uid"(), "id", ARRAY['admin'::"text"]));


--
-- Name: users Users can update records of other users in orgs they're admins ; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update records of other users in orgs they're admins " ON "public"."users" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "target_user_om"
  WHERE ("public"."is_member_of"("auth"."uid"(), "target_user_om"."organization_id", ARRAY['admin'::"text"]) AND ("target_user_om"."user_id" = "users"."id") AND ("target_user_om"."deleted_at" IS NULL)))));


--
-- Name: input_parameters Users can upsert org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert org-wide records of organizations they're admi" ON "public"."input_parameters" FOR UPDATE WITH CHECK (("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]) AND ("user_id" IS NULL)));


--
-- Name: monitoring_rule_evaluations Users can upsert org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert org-wide records of organizations they're admi" ON "public"."monitoring_rule_evaluations" FOR UPDATE WITH CHECK (("monitoring_rule_id" IN ( SELECT "monitoring_rules"."id"
   FROM "public"."monitoring_rules"
  WHERE "public"."is_member_of"("auth"."uid"(), "monitoring_rules"."organization_id", ARRAY['admin'::"text"]))));


--
-- Name: refresh_job_runs Users can upsert org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert org-wide records of organizations they're admi" ON "public"."refresh_job_runs" FOR UPDATE WITH CHECK (("refresh_job_id" IN ( SELECT "refresh_jobs"."id"
   FROM "public"."refresh_jobs"
  WHERE "public"."is_member_of"("auth"."uid"(), "refresh_jobs"."organization_id", ARRAY['admin'::"text"]))));


--
-- Name: refresh_jobs Users can upsert org-wide records of organizations they're admi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert org-wide records of organizations they're admi" ON "public"."refresh_jobs" FOR UPDATE WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: input_parameters Users can upsert own records within organizations they're membe; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert own records within organizations they're membe" ON "public"."input_parameters" FOR UPDATE WITH CHECK (("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]) AND ("user_id" = "auth"."uid"())));


--
-- Name: database_connections Users can upsert records of organizations they're admins of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert records of organizations they're admins of." ON "public"."database_connections" FOR UPDATE WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: graph_syncs Users can upsert records of organizations they're admins of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert records of organizations they're admins of." ON "public"."graph_syncs" FOR UPDATE WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text"]));


--
-- Name: edges Users can upsert records of organizations they're admins or edi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert records of organizations they're admins or edi" ON "public"."edges" FOR UPDATE WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: nodes Users can upsert records of organizations they're admins or edi; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert records of organizations they're admins or edi" ON "public"."nodes" FOR UPDATE WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: goals Users can upsert records of organizations they're editors of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert records of organizations they're editors of." ON "public"."goals" FOR UPDATE WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: monitoring_rules Users can upsert records of organizations they're editors of.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert records of organizations they're editors of." ON "public"."monitoring_rules" FOR UPDATE WITH CHECK ("public"."is_member_of"("auth"."uid"(), "organization_id", ARRAY['admin'::"text", 'editor'::"text"]));


--
-- Name: database_connection_types Users have select permissions on all records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users have select permissions on all records" ON "public"."database_connection_types" FOR SELECT USING (true);


--
-- Name: edge_types Users have select permissions on all records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users have select permissions on all records" ON "public"."edge_types" FOR SELECT USING (true);


--
-- Name: function_types Users have select permissions on all records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users have select permissions on all records" ON "public"."function_types" FOR SELECT USING (true);


--
-- Name: graph_sync_types Users have select permissions on all records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users have select permissions on all records" ON "public"."graph_sync_types" FOR SELECT USING (true);


--
-- Name: node_types Users have select permissions on all records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users have select permissions on all records" ON "public"."node_types" FOR SELECT USING (true);


--
-- Name: roles Users have select permissions on all records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users have select permissions on all records" ON "public"."roles" FOR SELECT USING (true);


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: database_connection_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."database_connection_types" ENABLE ROW LEVEL SECURITY;

--
-- Name: database_connections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."database_connections" ENABLE ROW LEVEL SECURITY;

--
-- Name: database_queries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."database_queries" ENABLE ROW LEVEL SECURITY;

--
-- Name: edge_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."edge_types" ENABLE ROW LEVEL SECURITY;

--
-- Name: edges; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."edges" ENABLE ROW LEVEL SECURITY;

--
-- Name: edges_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."edges_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: function_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."function_types" ENABLE ROW LEVEL SECURITY;

--
-- Name: goals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;

--
-- Name: graph_sync_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."graph_sync_types" ENABLE ROW LEVEL SECURITY;

--
-- Name: graph_syncs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."graph_syncs" ENABLE ROW LEVEL SECURITY;

--
-- Name: input_parameters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."input_parameters" ENABLE ROW LEVEL SECURITY;

--
-- Name: monitoring_rule_evaluations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."monitoring_rule_evaluations" ENABLE ROW LEVEL SECURITY;

--
-- Name: monitoring_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."monitoring_rules" ENABLE ROW LEVEL SECURITY;

--
-- Name: node_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."node_types" ENABLE ROW LEVEL SECURITY;

--
-- Name: nodes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."nodes" ENABLE ROW LEVEL SECURITY;

--
-- Name: nodes_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."nodes_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_job_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."refresh_job_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."refresh_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "algorithm_sign"("signables" "text", "secret" "text", "algorithm" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."algorithm_sign"("signables" "text", "secret" "text", "algorithm" "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."algorithm_sign"("signables" "text", "secret" "text", "algorithm" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "armor"("bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "armor"("bytea", "text"[], "text"[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "crypt"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "dearmor"("text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "decrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "digest"("bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "digest"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "encrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "encrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gen_random_bytes"(integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gen_random_uuid"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gen_salt"("text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gen_salt"("text", integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hmac"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hmac"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "blk_read_time" double precision, OUT "blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "blk_read_time" double precision, OUT "blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric) TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "blk_read_time" double precision, OUT "blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint) TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_key_id"("bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sign"("payload" "json", "secret" "text", "algorithm" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sign"("payload" "json", "secret" "text", "algorithm" "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."sign"("payload" "json", "secret" "text", "algorithm" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "try_cast_double"("inp" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."try_cast_double"("inp" "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."try_cast_double"("inp" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "url_decode"("data" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."url_decode"("data" "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."url_decode"("data" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "url_encode"("data" "bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."url_encode"("data" "bytea") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."url_encode"("data" "bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v1"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v1mc"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v3"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v4"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v5"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_nil"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_ns_dns"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_ns_oid"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_ns_url"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_ns_x500"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "verify"("token" "text", "secret" "text", "algorithm" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."verify"("token" "text", "secret" "text", "algorithm" "text") TO "dashboard_user";
-- GRANT ALL ON FUNCTION "extensions"."verify"("token" "text", "secret" "text", "algorithm" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "comment_directive"("comment_" "text"); Type: ACL; Schema: graphql; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "graphql"."comment_directive"("comment_" "text") TO "postgres";
-- GRANT ALL ON FUNCTION "graphql"."comment_directive"("comment_" "text") TO "anon";
-- GRANT ALL ON FUNCTION "graphql"."comment_directive"("comment_" "text") TO "authenticated";
-- GRANT ALL ON FUNCTION "graphql"."comment_directive"("comment_" "text") TO "service_role";


--
-- Name: FUNCTION "exception"("message" "text"); Type: ACL; Schema: graphql; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "graphql"."exception"("message" "text") TO "postgres";
-- GRANT ALL ON FUNCTION "graphql"."exception"("message" "text") TO "anon";
-- GRANT ALL ON FUNCTION "graphql"."exception"("message" "text") TO "authenticated";
-- GRANT ALL ON FUNCTION "graphql"."exception"("message" "text") TO "service_role";


--
-- Name: FUNCTION "get_schema_version"(); Type: ACL; Schema: graphql; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "graphql"."get_schema_version"() TO "postgres";
-- GRANT ALL ON FUNCTION "graphql"."get_schema_version"() TO "anon";
-- GRANT ALL ON FUNCTION "graphql"."get_schema_version"() TO "authenticated";
-- GRANT ALL ON FUNCTION "graphql"."get_schema_version"() TO "service_role";


--
-- Name: FUNCTION "increment_schema_version"(); Type: ACL; Schema: graphql; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "graphql"."increment_schema_version"() TO "postgres";
-- GRANT ALL ON FUNCTION "graphql"."increment_schema_version"() TO "anon";
-- GRANT ALL ON FUNCTION "graphql"."increment_schema_version"() TO "authenticated";
-- GRANT ALL ON FUNCTION "graphql"."increment_schema_version"() TO "service_role";


--
-- Name: FUNCTION "graphql"("operationName" "text", "query" "text", "variables" "jsonb", "extensions" "jsonb"); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "graphql_public"."graphql"("operationName" "text", "query" "text", "variables" "jsonb", "extensions" "jsonb") TO "postgres";
-- GRANT ALL ON FUNCTION "graphql_public"."graphql"("operationName" "text", "query" "text", "variables" "jsonb", "extensions" "jsonb") TO "anon";
-- GRANT ALL ON FUNCTION "graphql_public"."graphql"("operationName" "text", "query" "text", "variables" "jsonb", "extensions" "jsonb") TO "authenticated";
-- GRANT ALL ON FUNCTION "graphql_public"."graphql"("operationName" "text", "query" "text", "variables" "jsonb", "extensions" "jsonb") TO "service_role";


--
-- Name: FUNCTION "create_organization_if_not_exists_and_user_membership_if_allowe"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."create_organization_if_not_exists_and_user_membership_if_allowe"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_organization_if_not_exists_and_user_membership_if_allowe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization_if_not_exists_and_user_membership_if_allowe"() TO "service_role";


--
-- Name: FUNCTION "is_member_of"("_user_id" "uuid", "_organization_id" "uuid", "role_names" "text"[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_member_of"("_user_id" "uuid", "_organization_id" "uuid", "role_names" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of"("_user_id" "uuid", "_organization_id" "uuid", "role_names" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of"("_user_id" "uuid", "_organization_id" "uuid", "role_names" "text"[]) TO "service_role";


--
-- Name: FUNCTION "maintain_edges_history"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."maintain_edges_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."maintain_edges_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maintain_edges_history"() TO "service_role";


--
-- Name: FUNCTION "maintain_nodes_history"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."maintain_nodes_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."maintain_nodes_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maintain_nodes_history"() TO "service_role";


--
-- Name: FUNCTION "organization_default_name_from_email"("email" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."organization_default_name_from_email"("email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."organization_default_name_from_email"("email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."organization_default_name_from_email"("email" "text") TO "service_role";


--
-- Name: FUNCTION "organization_domain_from_email"("email" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."organization_domain_from_email"("email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."organization_domain_from_email"("email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."organization_domain_from_email"("email" "text") TO "service_role";


--
-- Name: FUNCTION "sync_user_records"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."sync_user_records"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_records"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_records"() TO "service_role";


--
-- Name: TABLE "pg_stat_statements"; Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "dashboard_user";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "pg_stat_statements_info"; Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "dashboard_user";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "postgres" WITH GRANT OPTION;


--
-- Name: SEQUENCE "seq_schema_version"; Type: ACL; Schema: graphql; Owner: supabase_admin
--

-- GRANT ALL ON SEQUENCE "graphql"."seq_schema_version" TO "postgres";
-- GRANT ALL ON SEQUENCE "graphql"."seq_schema_version" TO "anon";
-- GRANT ALL ON SEQUENCE "graphql"."seq_schema_version" TO "authenticated";
-- GRANT ALL ON SEQUENCE "graphql"."seq_schema_version" TO "service_role";


--
-- Name: TABLE "goals"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";


--
-- Name: TABLE "columnar_goals"; Type: ACL; Schema: public; Owner: authenticated
--

GRANT ALL ON TABLE "public"."columnar_goals" TO "postgres";
GRANT ALL ON TABLE "public"."columnar_goals" TO "anon";
GRANT ALL ON TABLE "public"."columnar_goals" TO "service_role";


--
-- Name: TABLE "comments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";


--
-- Name: TABLE "database_connection_types"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."database_connection_types" TO "anon";
GRANT ALL ON TABLE "public"."database_connection_types" TO "authenticated";
GRANT ALL ON TABLE "public"."database_connection_types" TO "service_role";


--
-- Name: TABLE "database_connections"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."database_connections" TO "anon";
GRANT ALL ON TABLE "public"."database_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."database_connections" TO "service_role";


--
-- Name: TABLE "database_queries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."database_queries" TO "anon";
GRANT ALL ON TABLE "public"."database_queries" TO "authenticated";
GRANT ALL ON TABLE "public"."database_queries" TO "service_role";


--
-- Name: TABLE "users"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";


--
-- Name: TABLE "display_users"; Type: ACL; Schema: public; Owner: authenticated
--

GRANT ALL ON TABLE "public"."display_users" TO "postgres";
GRANT ALL ON TABLE "public"."display_users" TO "anon";
GRANT ALL ON TABLE "public"."display_users" TO "service_role";


--
-- Name: TABLE "edge_types"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."edge_types" TO "anon";
GRANT ALL ON TABLE "public"."edge_types" TO "authenticated";
GRANT ALL ON TABLE "public"."edge_types" TO "service_role";


--
-- Name: TABLE "edges"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."edges" TO "anon";
GRANT ALL ON TABLE "public"."edges" TO "authenticated";
GRANT ALL ON TABLE "public"."edges" TO "service_role";


--
-- Name: TABLE "edges_history"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."edges_history" TO "anon";
GRANT ALL ON TABLE "public"."edges_history" TO "authenticated";
GRANT ALL ON TABLE "public"."edges_history" TO "service_role";


--
-- Name: TABLE "function_types"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."function_types" TO "anon";
GRANT ALL ON TABLE "public"."function_types" TO "authenticated";
GRANT ALL ON TABLE "public"."function_types" TO "service_role";


--
-- Name: TABLE "graph_sync_types"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."graph_sync_types" TO "anon";
GRANT ALL ON TABLE "public"."graph_sync_types" TO "authenticated";
GRANT ALL ON TABLE "public"."graph_sync_types" TO "service_role";


--
-- Name: TABLE "graph_syncs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."graph_syncs" TO "anon";
GRANT ALL ON TABLE "public"."graph_syncs" TO "authenticated";
GRANT ALL ON TABLE "public"."graph_syncs" TO "service_role";


--
-- Name: TABLE "input_parameters"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."input_parameters" TO "anon";
GRANT ALL ON TABLE "public"."input_parameters" TO "authenticated";
GRANT ALL ON TABLE "public"."input_parameters" TO "service_role";


--
-- Name: TABLE "monitoring_rule_evaluations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."monitoring_rule_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."monitoring_rule_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."monitoring_rule_evaluations" TO "service_role";


--
-- Name: TABLE "monitoring_rules"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."monitoring_rules" TO "anon";
GRANT ALL ON TABLE "public"."monitoring_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."monitoring_rules" TO "service_role";


--
-- Name: TABLE "latest_monitoring_rule_evaluations"; Type: ACL; Schema: public; Owner: authenticated
--

GRANT ALL ON TABLE "public"."latest_monitoring_rule_evaluations" TO "postgres";
GRANT ALL ON TABLE "public"."latest_monitoring_rule_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."latest_monitoring_rule_evaluations" TO "service_role";


--
-- Name: TABLE "node_types"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."node_types" TO "anon";
GRANT ALL ON TABLE "public"."node_types" TO "authenticated";
GRANT ALL ON TABLE "public"."node_types" TO "service_role";


--
-- Name: TABLE "nodes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."nodes" TO "anon";
GRANT ALL ON TABLE "public"."nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."nodes" TO "service_role";


--
-- Name: TABLE "nodes_history"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."nodes_history" TO "anon";
GRANT ALL ON TABLE "public"."nodes_history" TO "authenticated";
GRANT ALL ON TABLE "public"."nodes_history" TO "service_role";


--
-- Name: TABLE "organization_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";


--
-- Name: TABLE "organizations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";


--
-- Name: TABLE "refresh_job_runs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."refresh_job_runs" TO "anon";
GRANT ALL ON TABLE "public"."refresh_job_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."refresh_job_runs" TO "service_role";


--
-- Name: TABLE "refresh_jobs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."refresh_jobs" TO "anon";
GRANT ALL ON TABLE "public"."refresh_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."refresh_jobs" TO "service_role";


--
-- Name: TABLE "roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";


--
-- PostgreSQL database dump complete
--

RESET ALL;

/**********************************************************************
 * Establish realtime
 **********************************************************************/
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.database_connection_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.database_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.database_queries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.edge_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.edges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.edges_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.function_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.graph_sync_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.graph_syncs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.input_parameters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monitoring_rule_evaluations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monitoring_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.node_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.refresh_job_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.refresh_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

/**********************************************************************
 * Initial population
 **********************************************************************/
INSERT INTO "public"."database_connection_types" ("name") VALUES ('snowflake');

INSERT INTO "public"."edge_types" ("name") VALUES ('input');

INSERT INTO "public"."function_types" ("name", "symbol") VALUES ('addition', '+');
INSERT INTO "public"."function_types" ("name", "symbol") VALUES ('subtraction', '-');
INSERT INTO "public"."function_types" ("name", "symbol") VALUES ('multiplication', '*');
INSERT INTO "public"."function_types" ("name", "symbol") VALUES ('division', '/');
INSERT INTO "public"."function_types" ("name", "symbol") VALUES ('identity', '=');
INSERT INTO "public"."function_types" ("name", "symbol") VALUES ('approximate_identity', '~');
INSERT INTO "public"."function_types" ("name", "symbol") VALUES ('increasing', 'f⁺(x)');
INSERT INTO "public"."function_types" ("name", "symbol") VALUES ('decreasing', 'f⁻(x)');

INSERT INTO "public"."graph_sync_types" ("name") VALUES ('dbt Project');

INSERT INTO "public"."node_types" ("name") VALUES ('metric');
INSERT INTO "public"."node_types" ("name") VALUES ('function');
INSERT INTO "public"."node_types" ("name") VALUES ('mission');
INSERT INTO "public"."node_types" ("name") VALUES ('custom');

-- include ids so above default_role_id default works
INSERT INTO "public"."roles" ("id", "name", "level") VALUES ('df65c75a-1e94-43b2-ad37-e7ff5ccc1735', 'awaiting_admin_approval', 0);
INSERT INTO "public"."roles" ("id", "name", "level") VALUES ('3e9fb851-ac1e-44bc-a6d9-f0ec2aa69a66', 'viewer', 1);
INSERT INTO "public"."roles" ("id", "name", "level") VALUES ('26829f0c-ccc9-4964-879b-4e787db0fc3a', 'editor', 2);
INSERT INTO "public"."roles" ("id", "name", "level") VALUES ('d41e6137-eff9-49fa-a7b7-a9fe51eb7852', 'admin', 3);

/**********************************************************************
 * Postflight
 **********************************************************************/
REVOKE USAGE, CREATE ON SCHEMA public FROM public;