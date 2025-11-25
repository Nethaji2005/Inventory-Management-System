import { useState } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useShop } from '@/contexts/ShopContext';
import { Upload, Store } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Settings() {
  const { state, dispatch } = useShop();
  const [shopSettings, setShopSettings] = useState({
    shopName: state.settings.shopName,
    address: state.settings.address || '',
    contact: state.settings.contact || '',
  });
  const [userSettings, setUserSettings] = useState({
    userName: state.settings.userName,
    newPassword: '',
  });
  const [shopLogoUrl, setShopLogoUrl] = useState(state.settings.shopLogo || '');
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const handleSaveShopDetails = async () => {
    setIsSavingShop(true);
    try {
      if (!state.authToken) {
        toast({
          title: "Error",
          description: "Not authenticated. Please login first.",
          variant: "destructive",
        });
        setIsSavingShop(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.authToken}`,
        },
        body: JSON.stringify({
          shopName: shopSettings.shopName,
          address: shopSettings.address,
          contact: shopSettings.contact,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast({
          title: "Error",
          description: error.error || "Failed to save shop details",
          variant: "destructive",
        });
        return;
      }

      dispatch({ 
        type: 'UPDATE_SETTINGS', 
        payload: shopSettings 
      });
      
      toast({
        title: "Settings Updated",
        description: "Shop details have been saved successfully",
      });
    } catch (error) {
      console.error('Failed to save shop details', error);
      toast({
        title: "Error",
        description: "Unable to connect to the server",
        variant: "destructive",
      });
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleSaveUserProfile = async () => {
    setIsSavingProfile(true);
    try {
      if (!state.authToken) {
        toast({
          title: "Error",
          description: "Not authenticated. Please login first.",
          variant: "destructive",
        });
        setIsSavingProfile(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.authToken}`,
        },
        body: JSON.stringify({
          name: userSettings.userName,
          ...(userSettings.newPassword && { password: userSettings.newPassword }),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast({
          title: "Error",
          description: error.error || "Failed to update profile",
          variant: "destructive",
        });
        return;
      }

      const result = await response.json();
      dispatch({ 
        type: 'UPDATE_SETTINGS', 
        payload: { userName: result.user?.name || userSettings.userName } 
      });

      setUserSettings({ ...userSettings, newPassword: '' });
      
      toast({
        title: "Profile Updated",
        description: "User profile has been saved successfully",
      });
    } catch (error) {
      console.error('Failed to update profile', error);
      toast({
        title: "Error",
        description: "Unable to connect to the server",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      if (!state.authToken) {
        toast({
          title: "Error",
          description: "Not authenticated. Please login first.",
          variant: "destructive",
        });
        setIsUploadingLogo(false);
        return;
      }

      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch(`${API_BASE_URL}/api/settings/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.authToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast({
          title: "Error",
          description: error.error || "Failed to upload logo",
          variant: "destructive",
        });
        return;
      }

      const result = await response.json();
      const logoUrl = result.shopLogo;
      
      const cacheBuster = `?t=${Date.now()}`;
      const logoUrlWithCache = `${logoUrl}${cacheBuster}`;
      
      setShopLogoUrl(logoUrlWithCache);
      dispatch({ 
        type: 'UPDATE_SETTINGS', 
        payload: { shopLogo: logoUrlWithCache } 
      });
      
      toast({
        title: "Logo Uploaded",
        description: "Shop logo has been updated successfully",
      });
    } catch (error) {
      console.error('Failed to upload logo', error);
      toast({
        title: "Error",
        description: "Unable to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      event.target.value = '';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your shop settings and user preferences
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* User Profile */}
          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userName">User Name</Label>
                <Input
                  id="userName"
                  value={userSettings.userName}
                  onChange={(e) => setUserSettings({ ...userSettings, userName: e.target.value })}
                  placeholder="Enter your name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">Change Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={userSettings.newPassword}
                  onChange={(e) => setUserSettings({ ...userSettings, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>

              <Button onClick={handleSaveUserProfile} className="w-full" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </CardContent>
          </Card>

          {/* Shop Details */}
          <Card>
            <CardHeader>
              <CardTitle>Shop Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shopName">Change Shop Name</Label>
                <Input
                  id="shopName"
                  value={shopSettings.shopName}
                  onChange={(e) => setShopSettings({ ...shopSettings, shopName: e.target.value })}
                  placeholder="Enter shop name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Shop Address</Label>
                <Input
                  id="address"
                  value={shopSettings.address}
                  onChange={(e) => setShopSettings({ ...shopSettings, address: e.target.value })}
                  placeholder="Enter shop address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact Information</Label>
                <Input
                  id="contact"
                  value={shopSettings.contact}
                  onChange={(e) => setShopSettings({ ...shopSettings, contact: e.target.value })}
                  placeholder="Enter contact details"
                />
              </div>

              <div className="space-y-2">
                <Label>Change Shop Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary overflow-hidden">
                    {shopLogoUrl ? (
                      <img src={shopLogoUrl} alt="Shop Logo" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-8 w-8 text-primary-foreground" />
                    )}
                  </div>
                  <div>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => document.getElementById('logo-upload')?.click()}
                      disabled={isUploadingLogo}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingLogo ? 'Uploading...' : 'Upload New Logo'}
                    </Button>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveShopDetails} className="w-full" disabled={isSavingShop}>
                {isSavingShop ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional Settings */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Shop Information</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Shop Name: {state.settings.shopName}</p>
                  <p>Total Products: {state.products.length}</p>
                  <p>Total Sales: {state.sales.length}</p>
                  <p>Total Purchases: {state.purchases.length}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">System Status</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Status: Online</p>
                  <p>Last Backup: Not configured</p>
                  <p>Version: 1.0.0</p>
                  <p>Database: Local Storage</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}