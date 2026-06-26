--
-- PostgreSQL database dump
--

\restrict bZ4BFYk80Qsj3iTar8J2ZnEmUocO3H4widd0Tr25g8ckaivYmJaFIaFW6EsfF7g

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: bet_outcome; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.bet_outcome AS ENUM (
    'player_a_wins',
    'player_b_wins'
);


ALTER TYPE public.bet_outcome OWNER TO postgres;

--
-- Name: bet_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.bet_status AS ENUM (
    'pending',
    'matched',
    'live',
    'won',
    'lost',
    'refunded',
    'cancelled'
);


ALTER TYPE public.bet_status OWNER TO postgres;

--
-- Name: game_result; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.game_result AS ENUM (
    'player_a_wins',
    'player_b_wins',
    'draw'
);


ALTER TYPE public.game_result OWNER TO postgres;

--
-- Name: game_sport; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.game_sport AS ENUM (
    'pool',
    'boxing',
    'football',
    'athletics',
    'basketball'
);


ALTER TYPE public.game_sport OWNER TO postgres;

--
-- Name: game_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.game_status AS ENUM (
    'upcoming',
    'live',
    'completed',
    'cancelled'
);


ALTER TYPE public.game_status OWNER TO postgres;

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_type AS ENUM (
    'bet_matched',
    'near_match',
    'deposit_received',
    'withdrawal_approved',
    'withdrawal_rejected',
    'stream_expiring',
    'bet_won',
    'bet_lost',
    'match_result',
    'bet_refunded',
    'low_balance'
);


ALTER TYPE public.notification_type OWNER TO postgres;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_method AS ENUM (
    'mtn_momo',
    'airtel_money',
    'btc_binance',
    'internal',
    'pesapal'
);


ALTER TYPE public.payment_method OWNER TO postgres;

--
-- Name: sport_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.sport_type AS ENUM (
    'pool',
    'boxing',
    'football',
    'athletics',
    'basketball',
    'tournament',
    'other'
);


ALTER TYPE public.sport_type OWNER TO postgres;

--
-- Name: stream_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.stream_status AS ENUM (
    'upcoming',
    'live',
    'ended',
    'cancelled'
);


ALTER TYPE public.stream_status OWNER TO postgres;

--
-- Name: transaction_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'rejected',
    'approved'
);


ALTER TYPE public.transaction_status OWNER TO postgres;

--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_type AS ENUM (
    'deposit',
    'withdrawal',
    'stream_access',
    'bet_stake',
    'bet_win',
    'bet_refund',
    'brokerage_fee',
    'voucher_redeem',
    'admin_credit',
    'admin_debit'
);


ALTER TYPE public.transaction_type OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'guest',
    'user',
    'moderator',
    'admin',
    'finance'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'suspended'
);


ALTER TYPE public.user_status OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.announcements OWNER TO postgres;

--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.announcements_id_seq OWNER TO postgres;

--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action text NOT NULL,
    entity_type text,
    entity_id integer,
    details text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: bets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bets (
    id integer NOT NULL,
    ticket_id text NOT NULL,
    user_id integer NOT NULL,
    game_id integer NOT NULL,
    outcome public.bet_outcome NOT NULL,
    stake numeric(12,2) NOT NULL,
    potential_return numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    status public.bet_status DEFAULT 'pending'::public.bet_status NOT NULL,
    matched_bet_id integer,
    settled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bets OWNER TO postgres;

--
-- Name: bets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bets_id_seq OWNER TO postgres;

--
-- Name: bets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bets_id_seq OWNED BY public.bets.id;


--
-- Name: games; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.games (
    id integer NOT NULL,
    sport public.game_sport NOT NULL,
    player_a text NOT NULL,
    player_b text NOT NULL,
    event_date date NOT NULL,
    event_time text NOT NULL,
    status public.game_status DEFAULT 'upcoming'::public.game_status NOT NULL,
    result public.game_result,
    total_bet_pool numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    open_bets_count integer DEFAULT 0 NOT NULL,
    matched_bets_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    event_end_date date,
    event_end_time text,
    city text,
    country text,
    type text DEFAULT 'single'::text NOT NULL,
    parent_id integer,
    player_a_country text,
    player_b_country text
);


ALTER TABLE public.games OWNER TO postgres;

--
-- Name: games_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.games_id_seq OWNER TO postgres;

--
-- Name: games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;


--
-- Name: hero_slides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hero_slides (
    id integer NOT NULL,
    title text NOT NULL,
    subtitle text,
    button_text text,
    button_url text,
    image_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.hero_slides OWNER TO postgres;

--
-- Name: hero_slides_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hero_slides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hero_slides_id_seq OWNER TO postgres;

--
-- Name: hero_slides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hero_slides_id_seq OWNED BY public.hero_slides.id;


--
-- Name: highlights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.highlights (
    id integer NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    youtube_url text NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.highlights OWNER TO postgres;

--
-- Name: highlights_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.highlights_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.highlights_id_seq OWNER TO postgres;

--
-- Name: highlights_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.highlights_id_seq OWNED BY public.highlights.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- Name: stream_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stream_access (
    id integer NOT NULL,
    user_id integer NOT NULL,
    stream_id integer NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stream_access OWNER TO postgres;

--
-- Name: stream_access_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stream_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_access_id_seq OWNER TO postgres;

--
-- Name: stream_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stream_access_id_seq OWNED BY public.stream_access.id;


--
-- Name: streams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.streams (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    sport public.sport_type DEFAULT 'pool'::public.sport_type NOT NULL,
    thumbnail_url text,
    hls_url text,
    stream_key text,
    status public.stream_status DEFAULT 'upcoming'::public.stream_status NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    viewer_count integer DEFAULT 0 NOT NULL,
    access_price numeric(6,2) DEFAULT 1.50 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    city text,
    country text
);


ALTER TABLE public.streams OWNER TO postgres;

--
-- Name: streams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.streams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.streams_id_seq OWNER TO postgres;

--
-- Name: streams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.streams_id_seq OWNED BY public.streams.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    transaction_id text NOT NULL,
    user_id integer NOT NULL,
    type public.transaction_type NOT NULL,
    amount numeric(12,2) NOT NULL,
    status public.transaction_status DEFAULT 'pending'::public.transaction_status NOT NULL,
    payment_method public.payment_method,
    reference text,
    description text,
    metadata text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    phone text,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    avatar_url text,
    refresh_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payout_method text,
    payout_account text,
    payout_method_set_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vouchers (
    id integer NOT NULL,
    code text NOT NULL,
    amount numeric(12,2) NOT NULL,
    is_redeemed boolean DEFAULT false NOT NULL,
    redeemed_by integer,
    redeemed_at timestamp with time zone,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vouchers OWNER TO postgres;

--
-- Name: vouchers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vouchers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vouchers_id_seq OWNER TO postgres;

--
-- Name: vouchers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vouchers_id_seq OWNED BY public.vouchers.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    available_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    pending_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    withdrawable_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.wallets OWNER TO postgres;

--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wallets_id_seq OWNER TO postgres;

--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: bets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bets ALTER COLUMN id SET DEFAULT nextval('public.bets_id_seq'::regclass);


--
-- Name: games id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);


--
-- Name: hero_slides id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hero_slides ALTER COLUMN id SET DEFAULT nextval('public.hero_slides_id_seq'::regclass);


--
-- Name: highlights id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.highlights ALTER COLUMN id SET DEFAULT nextval('public.highlights_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: stream_access id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_access ALTER COLUMN id SET DEFAULT nextval('public.stream_access_id_seq'::regclass);


--
-- Name: streams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.streams ALTER COLUMN id SET DEFAULT nextval('public.streams_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vouchers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers ALTER COLUMN id SET DEFAULT nextval('public.vouchers_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.announcements (id, title, content, is_active, priority, created_at, updated_at) FROM stdin;
1	Welcome to ATA Sports 	Stream live Pool & Boxing matches. New events added weekly! Now more then ever, we bring you the games	f	10	2026-06-15 19:17:47.184937+00	2026-06-26 12:27:45.663+00
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: bets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bets (id, ticket_id, user_id, game_id, outcome, stake, potential_return, status, matched_bet_id, settled_at, created_at, updated_at) FROM stdin;
1	TKT-80CBCB97	2	2	player_b_wins	40.00	0.00	pending	\N	\N	2026-06-15 16:42:22.409097+00	2026-06-15 16:42:22.409097+00
2	TKT-94544E67	2	3	player_a_wins	2.00	0.00	pending	\N	\N	2026-06-15 21:22:49.715996+00	2026-06-15 21:22:49.715996+00
3	TKT-F426B032	1	3	player_a_wins	2.00	0.00	pending	\N	\N	2026-06-25 22:53:12.644571+00	2026-06-25 22:53:12.644571+00
\.


--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.games (id, sport, player_a, player_b, event_date, event_time, status, result, total_bet_pool, open_bets_count, matched_bets_count, created_at, updated_at, event_end_date, event_end_time, city, country, type, parent_id, player_a_country, player_b_country) FROM stdin;
4	boxing	Joseph Kato	Richard Wanyama	2026-06-22	18:00	upcoming	\N	0.00	0	0	2026-06-15 16:31:06.632179+00	2026-06-15 16:31:06.632179+00	\N	\N	\N	\N	single	\N	\N	\N
5	pool	Samuel Kagwa	Alex Mutumba	2026-06-13	17:00	completed	player_a_wins	240.00	0	8	2026-06-15 16:31:06.632179+00	2026-06-15 16:31:06.632179+00	\N	\N	\N	\N	single	\N	\N	\N
2	boxing	Moses Nkosi	Emmanuel Atiku	2026-06-16	20:00	upcoming	\N	0.00	1	0	2026-06-15 16:31:06.632179+00	2026-06-15 16:42:22.416+00	\N	\N	\N	\N	single	\N	\N	\N
6	boxing	Matavu Ukasha	Kasasa Isaac	2026-06-20	14:00	upcoming	\N	0.00	0	0	2026-06-15 18:45:17.011713+00	2026-06-15 18:45:17.011713+00	\N	\N	\N	\N	single	\N	\N	\N
7	pool	Ali Hassan	John Doe	2026-06-20	15:00	upcoming	\N	0.00	0	0	2026-06-15 19:06:10.922877+00	2026-06-15 19:06:10.922877+00	\N	\N	\N	\N	single	\N	\N	\N
8	pool	Big Kels – ATA International Clash		2026-06-18	11:00	upcoming	\N	0.00	0	0	2026-06-15 19:41:45.888663+00	2026-06-15 19:41:45.888663+00	2026-06-21	14:30	Lagos	Nigeria	competition	\N	\N	\N
9	pool	Caesar Chandinga	Serge	2026-06-18	18:00	upcoming	\N	0.00	0	0	2026-06-15 19:52:47.086143+00	2026-06-15 19:52:47.086143+00	\N	\N	Lagos	Nigeria	single	8	\N	\N
12	pool	Caesar Chandinga	Jabulani	2026-06-21	16:54	upcoming	\N	0.00	0	0	2026-06-15 19:55:04.828187+00	2026-06-15 20:12:18.086+00	\N	\N	Lagos	Nigeria	single	8	UG	CD
11	pool	Jacob	Caesar Chandinga	2026-06-20	20:00	upcoming	\N	0.00	0	0	2026-06-15 19:54:24.775026+00	2026-06-15 20:52:16.387+00	\N	\N	Lagos	Nigeria	single	8	TZ	UG
10	pool	Siyabonga Shezi	Caesar Chandinga	2026-06-19	18:00	upcoming	\N	0.00	0	0	2026-06-15 19:53:28.784467+00	2026-06-15 20:53:34.678+00	\N	\N	Lagos	Nigeria	single	8	ZA	UG
1	pool	Hassan Mukasa	David Ssemwanga	2026-06-15	19:00	completed	player_b_wins	90.00	5	3	2026-06-15 16:31:06.632179+00	2026-06-15 21:17:47.146+00	\N	\N	\N	\N	single	\N	\N	\N
3	pool	Brian Lubega	Patrick Okello	2026-06-16	15:00	upcoming	\N	0.00	2	0	2026-06-15 16:31:06.632179+00	2026-06-25 22:53:12.651+00	\N	\N	\N	\N	single	\N	\N	\N
\.


--
-- Data for Name: hero_slides; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hero_slides (id, title, subtitle, button_text, button_url, image_url, sort_order, is_active, created_at, updated_at) FROM stdin;
1	The Nerve Center of African Sports	Watch live grassroots Pool and Boxing matches. Bet peer-to-peer in real-time. High stakes, zero clutter.	Join the movement	/register	/uploads/thumb-1782418209426-pwjxlt.jpg	0	t	2026-06-25 20:10:13.755801	2026-06-25 20:10:13.755801
2	Africa’s home of sport	Join Africa’s largest sports streaming community and watch the continent’s best talent live in HD.	Subcribe just from 1.5$ / 24H	/register	/uploads/thumb-1782418338861-x7bh0s.jpg	0	t	2026-06-25 20:12:23.612147	2026-06-25 20:12:23.612147
\.


--
-- Data for Name: highlights; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.highlights (id, title, description, youtube_url, is_published, created_at, updated_at) FROM stdin;
1	Ceaser Chandiga v Kristi Caulfield | Pro Series Event	HERE COMES DA SCORPION | Ceaser Chandiga v Kristi Caulfield | Pro Series Event 1 Last 64 2026	https://www.youtube.com/watch?v=o3b1a5mnO9M	t	2026-06-15 22:33:25.553527+00	2026-06-15 22:34:05.012+00
2	TOM COUSINS VS CEASAR CHANDIGA	£30,000 AFRICAN PRIDE MONEY MATCH | FULL MATCH\nFull replay of a high-stakes money match	https://www.youtube.com/watch?v=BxN1U0QYA9g	t	2026-06-15 22:35:35.937751+00	2026-06-15 22:35:35.937751+00
3	CEASER DA SCORPION vs ADEN JOSEPH GHOST	HIGHLIGHTS – THE EPIC MONEY MATCH FULL LIVE STREAM\nFull replay of a high-stakes money match where Scorpion and Ghost go shot for shot under pressure.	https://www.youtube.com/watch?v=0RHMLSwjwpo	t	2026-06-15 22:37:32.330699+00	2026-06-15 22:37:32.330699+00
4	CEASER CHANDIGA VS IBRAH SSEJEMBA TRIPLE BATTLE	DAY 1 HIGHLIGHTS: “CEASER CHANDIGA Vs IBRAH SSEJEMBA” TRIPLE BATTLE\nFull replay of day one featuring three intense battles and the opening chapter of a fierce rivalry.	https://www.youtube.com/watch?v=UvLlPRbw7wI	t	2026-06-15 22:39:03.425307+00	2026-06-15 22:39:03.425307+00
5	CEASER CHANDIGA VS IBRAH SSEJEMBA - TRIPLE BATTLE	DAY 3 HIGHLIGHTS “CEASER CHANDIGA Vs IBRAH SSEJEMBA” TRIPLE BATTLE\nFull replay of day three as the rivalry heats up with bigger moments and decisive racks.	https://www.youtube.com/watch?v=dxhdUIaa9o4	t	2026-06-15 22:42:04.887419+00	2026-06-15 22:42:04.887419+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, title, message, read, created_at) FROM stdin;
1	2	deposit_received	Account Credited	+$10 — Test credit	t	2026-06-15 17:53:38.382367+00
2	2	deposit_received	Deposit Confirmed	$21 has been added to your wallet.	t	2026-06-15 17:55:45.156587+00
3	2	withdrawal_approved	Withdrawal Approved	Your withdrawal of $12.00 has been approved.	t	2026-06-15 17:57:53.644799+00
4	2	deposit_received	Voucher Redeemed	$10.00 has been added to your wallet.	t	2026-06-15 18:04:53.735599+00
5	2	withdrawal_approved	Withdrawal Approved	Your withdrawal of $5.00 has been approved.	f	2026-06-25 22:34:52.658949+00
6	2	withdrawal_approved	Withdrawal Approved	Your withdrawal of $3.00 has been approved and is being processed by our finance team.	f	2026-06-25 22:48:21.687562+00
7	2	withdrawal_approved	Payment Sent	Your withdrawal of $3.00 has been paid. Please check your airtel money account.	f	2026-06-25 22:48:21.827435+00
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.settings (key, value, updated_at) FROM stdin;
liveStreamUrl		2026-06-15 23:01:56.521376+00
pesapal_consumer_key	n8oH1EgY3l+BI9ax/Lz9viA9DSLLVNSR	2026-06-25 22:14:02.252672+00
pesapal_consumer_secret	y6frhAV12Vl7JJLIvLQiF8FJDkU=	2026-06-25 22:14:02.252672+00
pesapal_environment	live	2026-06-25 22:14:02.252672+00
pesapal_ipn_id	d7c51ff3-b23f-44f2-8e7e-da3722300b9a	2026-06-25 22:14:12.016673+00
pesapal_currency	USD	2026-06-25 22:18:38.344018+00
\.


--
-- Data for Name: stream_access; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stream_access (id, user_id, stream_id, granted_at, expires_at, created_at) FROM stdin;
1	2	6	2026-06-15 20:14:11.119+00	2026-06-16 20:14:11.119+00	2026-06-15 20:14:11.16535+00
2	2	5	2026-06-15 20:15:23.301+00	2026-06-16 20:15:23.301+00	2026-06-15 20:15:23.3139+00
3	2	3	2026-06-15 22:11:37.424+00	2026-06-16 22:11:37.424+00	2026-06-15 22:11:37.445919+00
\.


--
-- Data for Name: streams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.streams (id, title, description, sport, thumbnail_url, hls_url, stream_key, status, start_time, end_time, viewer_count, access_price, created_at, updated_at, city, country) FROM stdin;
4	Nakawa Boxing Club Showcase	Young boxing talents from Nakawa show what they've got.	boxing	https://images.unsplash.com/photo-1565846930803-a7e4a6b7e5e4?w=800&q=80	\N	\N	ended	2026-06-12 16:31:06.62+00	2026-06-13 16:31:06.62+00	0	1.50	2026-06-15 16:31:06.623709+00	2026-06-15 16:31:06.623709+00	\N	\N
1	Kampala Pool Championship - Quarter Finals	Top pool players from Kampala face off in the quarter final round.	pool	https://images.unsplash.com/photo-1615672968435-75e0c291cd6e?w=800&q=80	https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8	\N	ended	2026-06-14 16:31:06.62+00	2026-06-15 16:34:42.477+00	142	1.50	2026-06-15 16:31:06.623709+00	2026-06-15 16:34:42.477+00	\N	\N
5	Test Pool Match	\N	pool	\N	\N	\N	upcoming	2026-07-05 12:13:24.231916+00	\N	0	1.50	2026-06-15 19:06:10.910462+00	2026-06-15 19:06:10.910462+00	\N	\N
2	Lugogo Boxing Night - Main Event	Heavyweight showdown at Lugogo Arena. The main event you've been waiting for.	boxing	https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80	\N	\N	upcoming	2026-06-29 12:13:24.231916+00	\N	0	1.50	2026-06-15 16:31:06.623709+00	2026-06-15 21:53:28.67+00	Lusaka	Zambia
11	Matavu Ukasha VS Kasasa Isaac	\N	boxing	\N	\N	\N	upcoming	2026-07-23 12:13:24.231916+00	\N	0	1.50	2026-06-15 23:14:13.462438+00	2026-06-15 23:14:13.462438+00	\N	\N
12	Ali Hassan VS John Doe	\N	pool	\N	\N	\N	upcoming	2026-07-26 12:13:24.231916+00	\N	0	1.50	2026-06-15 23:14:13.462438+00	2026-06-15 23:14:13.462438+00	\N	\N
6	Musuna Jule VS Alex Ambo		tournament	/uploads/thumb-1781565397631-khwqz5.png	\N	\N	upcoming	2026-07-08 12:13:24.231916+00	\N	0	1.50	2026-06-15 19:06:11.15375+00	2026-06-15 23:16:38.779+00	\N	\N
15	Joseph Kato VS Richard Wanyama		boxing	/uploads/thumb-1781565449802-31q8lm.jpg	\N	\N	upcoming	2026-08-04 12:13:24.231916+00	\N	0	1.50	2026-06-15 23:14:13.462438+00	2026-06-15 23:17:30.071+00	\N	\N
14	Caesar Chandinga VS Jabulani		pool	/uploads/thumb-1781565468263-x84aol.jpg	\N	\N	upcoming	2026-08-01 12:13:24.231916+00	\N	0	1.50	2026-06-15 23:14:13.462438+00	2026-06-15 23:17:48.614+00	Lagos	Nigeria
13	Jacob VS Caesar Chandinga		pool	/uploads/thumb-1781565483093-ej4d6o.jpeg	\N	\N	upcoming	2026-07-29 12:13:24.231916+00	\N	0	1.50	2026-06-15 23:14:13.462438+00	2026-06-15 23:18:03.377+00	Lagos	Nigeria
3	Kyebando Pool League - Finals	The best pool players in Kyebando compete for the league title.	pool	/uploads/thumb-1781565511893-cf2kgm.png	\N	\N	upcoming	2026-07-02 12:13:24.231916+00	\N	0	1.50	2026-06-15 16:31:06.623709+00	2026-06-15 23:18:32.232+00	Kampala	Uganda
8	Moses Nkosi VS Emmanuel Atiku		boxing	/uploads/thumb-1781565578428-k8dj0x.jpg	\N	\N	upcoming	2026-07-14 12:13:24.231916+00	\N	0	1.50	2026-06-15 23:14:13.462438+00	2026-06-15 23:19:39.043+00	\N	\N
7	Brian Lubega VS Patrick Okello		pool	/uploads/thumb-1781565625295-0oehmv.jpg	\N	\N	upcoming	2026-07-11 12:13:24.231916+00	\N	0	1.50	2026-06-15 23:14:13.462438+00	2026-06-15 23:20:25.592+00	\N	\N
9	Caesar Chandinga VS Serge		pool	/uploads/thumb-1781565653292-8uuyff.jpeg	\N	\N	upcoming	2026-07-17 12:13:24.231916+00	\N	0	1.50	2026-06-15 23:14:13.462438+00	2026-06-15 23:20:53.647+00	Lagos	Nigeria
10	Siyabonga Shezi VS Caesar Chandinga		pool	/uploads/thumb-1781565717628-74qmou.jpg	\N	\N	upcoming	2026-07-20 12:13:24.231916+00	\N	0	1.50	2026-06-15 23:14:13.462438+00	2026-06-15 23:21:57.935+00	Lagos	Nigeria
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, transaction_id, user_id, type, amount, status, payment_method, reference, description, metadata, created_at, updated_at) FROM stdin;
1	BET-9DB5D758	2	bet_stake	40.00	completed	internal	\N	Bet stake on game #2	\N	2026-06-15 16:42:22.274138+00	2026-06-15 16:42:22.274138+00
2	ADJ-B8EE4056	2	admin_credit	10.00	completed	internal	\N	Test credit	\N	2026-06-15 17:53:38.377228+00	2026-06-15 17:53:38.377228+00
3	DEP-E2ED7E27	2	deposit	21.00	completed	mtn_momo	5	Deposit via mtn_momo	\N	2026-06-15 17:55:45.112649+00	2026-06-15 17:55:45.147+00
4	WIT-E97D2E10	2	withdrawal	12.00	completed	mtn_momo	54	Withdrawal via mtn_momo	\N	2026-06-15 17:56:03.026237+00	2026-06-15 17:57:53.607+00
5	VCH-014948	2	voucher_redeem	10.00	completed	internal	\N	Voucher 014948 redeemed	\N	2026-06-15 18:04:53.731233+00	2026-06-15 18:04:53.731233+00
6	STR-E1EB69E1	2	stream_access	1.50	completed	internal	\N	24h access to: Kampala Open Tournament	\N	2026-06-15 20:14:11.156501+00	2026-06-15 20:14:11.156501+00
7	STR-D7A0AA77	2	stream_access	1.50	completed	internal	\N	24h access to: Test Pool Match	\N	2026-06-15 20:15:23.309961+00	2026-06-15 20:15:23.309961+00
8	BET-9312F53B	2	bet_stake	2.00	completed	internal	\N	Bet stake on game #3	\N	2026-06-15 21:22:49.701492+00	2026-06-15 21:22:49.701492+00
9	STR-1F420619	2	stream_access	1.50	completed	internal	\N	24h access to: Kyebando Pool League - Finals	\N	2026-06-15 22:11:37.437814+00	2026-06-15 22:11:37.437814+00
10	DEP-46AE2553	1	deposit	5000.00	failed	pesapal	\N	Pesapal deposit of UGX 5000	\N	2026-06-25 22:14:10.799392+00	2026-06-25 22:14:12.166+00
11	DEP-9E1F8910	1	deposit	5000.00	pending	pesapal	752c8a8b-1a4f-4b64-9a51-da3708d452e2	Pesapal deposit of UGX 5000	{"orderTrackingId":"752c8a8b-1a4f-4b64-9a51-da3708d452e2"}	2026-06-25 22:14:42.472359+00	2026-06-25 22:14:43.621+00
12	DEP-9DADDC3E	2	deposit	5.00	pending	pesapal	24081945-5888-44d3-8d1a-da373e0665dd	Pesapal deposit of USD 5	{"orderTrackingId":"24081945-5888-44d3-8d1a-da373e0665dd"}	2026-06-25 22:19:02.22138+00	2026-06-25 22:19:03.451+00
13	WIT-FA9B2DAB	2	withdrawal	5.00	completed	mtn_momo	0771234567	Withdrawal via mtn_momo to 0771234567	\N	2026-06-25 22:26:28.394759+00	2026-06-25 22:34:52.651+00
14	WIT-E67E7CA6	2	withdrawal	3.00	completed	airtel_money	0751999888	Withdrawal via airtel_money to 0751999888	\N	2026-06-25 22:48:21.560621+00	2026-06-25 22:48:21.821+00
15	DEP-526D3084	1	deposit	5.00	pending	pesapal	a1ccaf41-0474-4609-a481-da377f67c6b7	Pesapal deposit of USD 5	{"orderTrackingId":"a1ccaf41-0474-4609-a481-da377f67c6b7"}	2026-06-25 22:49:48.657561+00	2026-06-25 22:49:49.78+00
16	BET-B4E6F1D0	1	bet_stake	2.00	completed	internal	\N	Bet stake on game #3	\N	2026-06-25 22:53:12.637187+00	2026-06-25 22:53:12.637187+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, full_name, phone, role, status, avatar_url, refresh_token, created_at, updated_at, payout_method, payout_account, payout_method_set_at) FROM stdin;
2	demo@ata.ug	$2b$10$N8ITyGNIa7Ox8DRHjodLdu8GDXNOTTs5YnY.KWdFV5qcNMIeAzGqe	Demo User	0771234567	user	active	\N	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJ1c2VyIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3ODI0Mjc3MDEsImV4cCI6MTc4NTAxOTcwMX0.ZzzHYHGDssRFUD4lXVjVYlGxNgCmj9t1r-zakywDWe8	2026-06-15 16:31:06.605107+00	2026-06-25 22:48:21.209+00	airtel_money	0751999888	2026-06-25 22:26:39.158694+00
3	finance@atasportslive.com	$2b$10$kYls7fiDwBZGh/f3VZu9a.MMXOYhby4Q/.TXly/IMin3.ioz1rE2.	Finance Officer	\N	finance	active	\N	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInJvbGUiOiJmaW5hbmNlIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3ODI0Mjc3MDEsImV4cCI6MTc4NTAxOTcwMX0.VRS8oDZ1cOwOB9sD7sUh_rkmDOO_MPstMrtbxX-1eWg	2026-06-25 22:43:39.335176+00	2026-06-25 22:48:21.489+00	\N	\N	\N
1	admin@ata.ug	$2b$10$WX52lSTwDL3CRAsV0oWPWe2FlPPUtgLrbdxnezotou.Qi49cnzYLq	ATA Admin	0700000000	admin	active	\N	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzgyNDc2OTA5LCJleHAiOjE3ODUwNjg5MDl9.0z8z0lj_6KSxaF4q_Q-PXoX18oLg48xMm6-wKiRiDw0	2026-06-15 16:31:06.226579+00	2026-06-26 12:28:29.438+00	\N	\N	\N
\.


--
-- Data for Name: vouchers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vouchers (id, code, amount, is_redeemed, redeemed_by, redeemed_at, created_by, created_at) FROM stdin;
1	228623	5.00	f	\N	\N	1	2026-06-15 17:53:38.305228+00
2	844836	5.00	f	\N	\N	1	2026-06-15 17:53:38.312669+00
3	156342	5.00	f	\N	\N	1	2026-06-15 17:53:38.316953+00
4	961968	10.00	f	\N	\N	1	2026-06-15 17:54:55.111194+00
5	204783	10.00	f	\N	\N	1	2026-06-15 17:54:55.123084+00
6	840475	10.00	f	\N	\N	1	2026-06-15 17:54:55.130353+00
7	751391	10.00	f	\N	\N	1	2026-06-15 17:54:55.136652+00
8	014948	10.00	t	2	2026-06-15 18:04:53.685+00	1	2026-06-15 17:54:55.14225+00
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallets (id, user_id, balance, available_balance, pending_balance, withdrawable_balance, currency, created_at, updated_at) FROM stdin;
2	2	66.50	24.50	42.00	66.50	USD	2026-06-15 16:31:06.612958+00	2026-06-25 22:48:21.824+00
1	1	10000.00	9998.00	2.00	10000.00	USD	2026-06-15 16:31:06.51595+00	2026-06-25 22:53:12.603+00
\.


--
-- Name: announcements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.announcements_id_seq', 1, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: bets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bets_id_seq', 3, true);


--
-- Name: games_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.games_id_seq', 12, true);


--
-- Name: hero_slides_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hero_slides_id_seq', 2, true);


--
-- Name: highlights_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.highlights_id_seq', 5, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 7, true);


--
-- Name: stream_access_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stream_access_id_seq', 3, true);


--
-- Name: streams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.streams_id_seq', 15, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 16, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: vouchers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vouchers_id_seq', 8, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wallets_id_seq', 2, true);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bets bets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bets
    ADD CONSTRAINT bets_pkey PRIMARY KEY (id);


--
-- Name: bets bets_ticket_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bets
    ADD CONSTRAINT bets_ticket_id_unique UNIQUE (ticket_id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- Name: hero_slides hero_slides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hero_slides
    ADD CONSTRAINT hero_slides_pkey PRIMARY KEY (id);


--
-- Name: highlights highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.highlights
    ADD CONSTRAINT highlights_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: stream_access stream_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_access
    ADD CONSTRAINT stream_access_pkey PRIMARY KEY (id);


--
-- Name: streams streams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_transaction_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_transaction_id_unique UNIQUE (transaction_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_code_key UNIQUE (code);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_unique UNIQUE (user_id);


--
-- Name: bets bets_game_id_games_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bets
    ADD CONSTRAINT bets_game_id_games_id_fk FOREIGN KEY (game_id) REFERENCES public.games(id);


--
-- Name: bets bets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bets
    ADD CONSTRAINT bets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stream_access stream_access_stream_id_streams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_access
    ADD CONSTRAINT stream_access_stream_id_streams_id_fk FOREIGN KEY (stream_id) REFERENCES public.streams(id);


--
-- Name: stream_access stream_access_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_access
    ADD CONSTRAINT stream_access_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: vouchers vouchers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: vouchers vouchers_redeemed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES public.users(id);


--
-- Name: wallets wallets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT CREATE ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict bZ4BFYk80Qsj3iTar8J2ZnEmUocO3H4widd0Tr25g8ckaivYmJaFIaFW6EsfF7g

