import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useRecognition() {
  const [recognizedItem, setRecognizedItem] = useState<string | null>(null);
  const { toast } = useToast();

  const recognize = async (image: Blob) => {
    const response = await fetch("/api/recognize", {
      method: "POST",
      body: image,
    });

    if (response.ok) {
      const { item } = await response.json();
      setRecognizedItem(item);
      toast({
        title: "Item Recognized",
        description: `Recognized: ${item}`,
      });
    } else {
      toast({
        title: "Recognition Failed",
        description: "Could not recognize item from image.",
        variant: "destructive",
      });
    }
  };

  return { recognizedItem, recognize };
}