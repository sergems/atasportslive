--
-- PostgreSQL database dump
--

\restrict ea8dGKscRcIuXgpKD4jHMD31dVeu8q1QgzueLso1B9jdPSfNgPuZPbPxKqToSqW

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
    'boxing'
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
    'internal'
);


ALTER TYPE public.payment_method OWNER TO postgres;

--
-- Name: sport_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.sport_type AS ENUM (
    'pool',
    'boxing',
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
    'rejected'
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
    'brokerage_fee'
);


ALTER TYPE public.transaction_type OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'guest',
    'user',
    'moderator',
    'admin'
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


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
\.


--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.games (id, sport, player_a, player_b, event_date, event_time, status, result, total_bet_pool, open_bets_count, matched_bets_count, created_at, updated_at) FROM stdin;
1	pool	Hassan Mukasa	David Ssemwanga	2026-06-15	19:00	live	\N	90.00	5	3	2026-06-15 16:31:06.632179+00	2026-06-15 16:31:06.632179+00
3	pool	Brian Lubega	Patrick Okello	2026-06-16	15:00	upcoming	\N	0.00	0	0	2026-06-15 16:31:06.632179+00	2026-06-15 16:31:06.632179+00
4	boxing	Joseph Kato	Richard Wanyama	2026-06-22	18:00	upcoming	\N	0.00	0	0	2026-06-15 16:31:06.632179+00	2026-06-15 16:31:06.632179+00
5	pool	Samuel Kagwa	Alex Mutumba	2026-06-13	17:00	completed	player_a_wins	240.00	0	8	2026-06-15 16:31:06.632179+00	2026-06-15 16:31:06.632179+00
2	boxing	Moses Nkosi	Emmanuel Atiku	2026-06-16	20:00	upcoming	\N	0.00	1	0	2026-06-15 16:31:06.632179+00	2026-06-15 16:42:22.416+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, title, message, read, created_at) FROM stdin;
\.


--
-- Data for Name: stream_access; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stream_access (id, user_id, stream_id, granted_at, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: streams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.streams (id, title, description, sport, thumbnail_url, hls_url, stream_key, status, start_time, end_time, viewer_count, access_price, created_at, updated_at) FROM stdin;
2	Lugogo Boxing Night - Main Event	Heavyweight showdown at Lugogo Arena. The main event you've been waiting for.	boxing	https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80	\N	\N	upcoming	2026-06-16 16:31:06.62+00	\N	0	1.50	2026-06-15 16:31:06.623709+00	2026-06-15 16:31:06.623709+00
3	Kyebando Pool League - Finals	The best pool players in Kyebando compete for the league title.	pool	https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80	\N	\N	upcoming	2026-06-17 16:31:06.62+00	\N	0	1.50	2026-06-15 16:31:06.623709+00	2026-06-15 16:31:06.623709+00
4	Nakawa Boxing Club Showcase	Young boxing talents from Nakawa show what they've got.	boxing	https://images.unsplash.com/photo-1565846930803-a7e4a6b7e5e4?w=800&q=80	\N	\N	ended	2026-06-12 16:31:06.62+00	2026-06-13 16:31:06.62+00	0	1.50	2026-06-15 16:31:06.623709+00	2026-06-15 16:31:06.623709+00
1	Kampala Pool Championship - Quarter Finals	Top pool players from Kampala face off in the quarter final round.	pool	https://images.unsplash.com/photo-1615672968435-75e0c291cd6e?w=800&q=80	https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8	\N	ended	2026-06-14 16:31:06.62+00	2026-06-15 16:34:42.477+00	142	1.50	2026-06-15 16:31:06.623709+00	2026-06-15 16:34:42.477+00
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, transaction_id, user_id, type, amount, status, payment_method, reference, description, metadata, created_at, updated_at) FROM stdin;
1	BET-9DB5D758	2	bet_stake	40.00	completed	internal	\N	Bet stake on game #2	\N	2026-06-15 16:42:22.274138+00	2026-06-15 16:42:22.274138+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, full_name, phone, role, status, avatar_url, refresh_token, created_at, updated_at) FROM stdin;
1	admin@ata.ug	$2b$10$WX52lSTwDL3CRAsV0oWPWe2FlPPUtgLrbdxnezotou.Qi49cnzYLq	ATA Admin	0700000000	admin	active	\N	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzgxNTQxMjQ2LCJleHAiOjE3ODQxMzMyNDZ9.23MAsp9IT4UZtW-UkSyz_NgptuzmynF3UawTAGSSWs8	2026-06-15 16:31:06.226579+00	2026-06-15 16:34:06.534+00
2	demo@ata.ug	$2b$10$N8ITyGNIa7Ox8DRHjodLdu8GDXNOTTs5YnY.KWdFV5qcNMIeAzGqe	Demo User	0771234567	user	active	\N	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJ1c2VyIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3ODE1NDEzNTcsImV4cCI6MTc4NDEzMzM1N30.aLbvVQhJB88Hr-hvIyC1JuC6vmrIwB3te87cXb7YCsM	2026-06-15 16:31:06.605107+00	2026-06-15 16:35:57.444+00
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallets (id, user_id, balance, available_balance, pending_balance, withdrawable_balance, currency, created_at, updated_at) FROM stdin;
1	1	10000.00	10000.00	0.00	10000.00	USD	2026-06-15 16:31:06.51595+00	2026-06-15 16:31:06.51595+00
2	2	50.00	10.00	40.00	50.00	USD	2026-06-15 16:31:06.612958+00	2026-06-15 16:42:21.93+00
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: bets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bets_id_seq', 1, true);


--
-- Name: games_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.games_id_seq', 5, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: stream_access_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stream_access_id_seq', 1, false);


--
-- Name: streams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.streams_id_seq', 4, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wallets_id_seq', 2, true);


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
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


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
-- Name: wallets wallets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict ea8dGKscRcIuXgpKD4jHMD31dVeu8q1QgzueLso1B9jdPSfNgPuZPbPxKqToSqW

