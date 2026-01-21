
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api-config";

export default function BackupPage() {
    const { toast } = useToast();

    const handleBackup = async () => {
        try {
            window.location.href = `${API_BASE_URL}/api/admin/backup`;
            toast({
                title: "Backup Started",
                description: "Your database backup is downloading...",
            });
        } catch (error) {
            toast({
                title: "Backup Failed",
                description: "Could not download backup.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Data Backup</h1>
                    <p className="text-muted-foreground">Manage your database backups and restoration.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5" />
                            Export Data
                        </CardTitle>
                        <CardDescription>
                            Download a complete snapshot of your current database.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleBackup} className="w-full">
                            Download Backup (.sqlite)
                        </Button>
                    </CardContent>
                </Card>

                <Card className="opacity-50 pointer-events-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Restore Data
                        </CardTitle>
                        <CardDescription>
                            Restore from a previous backup file. (Coming Soon)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" className="w-full">
                            Upload Backup File
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
