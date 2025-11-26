import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { authStorage, useShop } from '@/contexts/ShopContext';
import { useNavigate } from 'react-router-dom';
import { BalaLogo } from '@/components/Brand/BalaLogo';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('admin@shop.local');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { state, dispatch } = useShop();
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://inventory-management-system-xyg3.onrender.com/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error || 'Invalid credentials';
        setErrorMessage(message);
        return;
      }

      if (!payload?.token || !payload?.user) {
        setErrorMessage('Authentication failed: missing token');
        return;
      }

      if (rememberMe) {
        authStorage.save({ token: payload.token, user: payload.user });
      } else {
        authStorage.clear();
      }

      dispatch({
        type: 'LOGIN',
        payload: {
          userName: payload.user?.name,
          token: payload.token,
          user: payload.user,
        },
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed', error);
      setErrorMessage('Unable to connect to the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-8 gap-4">
          {state.settings.shopLogo ? (
            <img
              src={state.settings.shopLogo}
              alt="Shop Logo"
              className="w-24 h-24 object-cover rounded-lg"
            />
          ) : (
            <BalaLogo className="w-24" />
          )}
          <span className="text-2xl font-bold text-foreground text-center">
            {state.settings.shopName}
          </span>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Welcome back
              </h1>
              <p className="text-muted-foreground">
                Log in to manage your store
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground">
                    Remember me
                  </Label>
                </div>
                <button type="button" className="text-sm text-primary hover:underline">
                  Forgot your password?
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Log In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <button className="text-primary hover:underline">
                  Sign up
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}