import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Globe, Languages } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { User, UpdateUserSettings } from "@shared/schema";

const languages = [
  { code: "ko", name: "한국어" },
  { code: "en", name: "English" },
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "ru", name: "Русский" },
];

export default function Settings() {
  const [selectedLanguage, setSelectedLanguage] = useState("ko");
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [translateToLanguage, setTranslateToLanguage] = useState("en");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setSelectedLanguage(user.preferredLanguage || "ko");
      setAutoTranslate(user.autoTranslate || false);
      setTranslateToLanguage(user.translateToLanguage || "en");
    }
  }, [user]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: UpdateUserSettings) => {
      return apiRequest("/api/users/settings", "PATCH", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    const settings: UpdateUserSettings = {
      preferredLanguage: selectedLanguage,
      autoTranslate,
      translateToLanguage: autoTranslate ? translateToLanguage : undefined,
    };
    
    updateSettingsMutation.mutate(settings);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" className="hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your chat preferences and settings</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>Profile Information</span>
              </CardTitle>
              <CardDescription>
                Your account details and basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="mt-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-900 dark:text-white">
                    {user.email}
                  </div>
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <div className="mt-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-900 dark:text-white">
                    @{user.email?.split('@')[0] || 'user'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Languages className="w-5 h-5" />
                <span>Language Settings</span>
              </CardTitle>
              <CardDescription>
                Choose your preferred language and translation options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="language">Default Language</Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This will be used as your primary interface language
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-translate">Auto Translation</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Automatically translate messages to your preferred language
                    </p>
                  </div>
                  <Switch
                    id="auto-translate"
                    checked={autoTranslate}
                    onCheckedChange={setAutoTranslate}
                  />
                </div>

                {autoTranslate && (
                  <div className="space-y-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                    <Label htmlFor="translate-to">Translate messages to</Label>
                    <Select value={translateToLanguage} onValueChange={setTranslateToLanguage}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select target language" />
                      </SelectTrigger>
                      <SelectContent>
                        {languages
                          .filter((lang) => lang.code !== selectedLanguage)
                          .map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Messages will be automatically translated to this language
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveSettings} 
              disabled={updateSettingsMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}