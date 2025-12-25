-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');
CREATE TYPE public.bus_status AS ENUM ('active', 'maintenance', 'offline');
CREATE TYPE public.media_type AS ENUM ('video', 'image');
CREATE TYPE public.device_status AS ENUM ('online', 'offline', 'error');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create buses table
CREATE TABLE public.buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number TEXT NOT NULL UNIQUE,
  route_name TEXT NOT NULL,
  status bus_status DEFAULT 'active',
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;

-- Create media_content table
CREATE TABLE public.media_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type media_type NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  file_size_mb DECIMAL(10, 2),
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.media_content ENABLE ROW LEVEL SECURITY;

-- Create schedules table
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID REFERENCES public.media_content(id) ON DELETE CASCADE,
  bus_id UUID REFERENCES public.buses(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Create devices table
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name TEXT NOT NULL UNIQUE,
  bus_id UUID REFERENCES public.buses(id) ON DELETE SET NULL,
  device_token TEXT,
  status device_status DEFAULT 'offline',
  last_seen TIMESTAMP WITH TIME ZONE,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Create news_feeds table
CREATE TABLE public.news_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.news_feeds ENABLE ROW LEVEL SECURITY;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for buses updated_at
CREATE TRIGGER update_buses_updated_at
  BEFORE UPDATE ON public.buses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for buses
CREATE POLICY "Authenticated users can view buses"
  ON public.buses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage buses"
  ON public.buses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can update bus location"
  ON public.buses FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for media_content
CREATE POLICY "Authenticated users can view media"
  ON public.media_content FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and operators can manage media"
  ON public.media_content FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operator')
  );

-- RLS Policies for schedules
CREATE POLICY "Authenticated users can view schedules"
  ON public.schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and operators can manage schedules"
  ON public.schedules FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operator')
  );

-- RLS Policies for devices
CREATE POLICY "Authenticated users can view devices"
  ON public.devices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage devices"
  ON public.devices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Devices can update their own status"
  ON public.devices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for news_feeds
CREATE POLICY "Everyone can view active news"
  ON public.news_feeds FOR SELECT
  TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Admins and operators can manage news"
  ON public.news_feeds FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operator')
  );

-- Enable realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_feeds;