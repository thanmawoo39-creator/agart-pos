import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'my' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="gap-2"
      title={`Switch to ${i18n.language === 'en' ? 'Burmese' : 'English'}`}
    >
      <Languages className="h-4 w-4" />
      <span className="hidden sm:inline">
        {i18n.language === 'en' ? 'MY' : 'EN'}
      </span>
    </Button>
  );
}
