import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Plus, Play, Trash2, ExternalLink, FileVideo, Link, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  name: string;
  type: 'file' | 'link';
  url: string;
  bus_id?: string;
  bus_number?: string;
  created_at: string;
  file_size?: number;
}

interface BusData {
  id: string;
  bus_number: string;
  route_name: string;
}

const Media = () => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [buses, setBuses] = useState<BusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form states
  const [mediaName, setMediaName] = useState("");
  const [selectedBus, setSelectedBus] = useState<string>("");
  const [videoLink, setVideoLink] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMediaItems();
    fetchBuses();
  }, []);

  const fetchMediaItems = async () => {
    try {
      const { data, error } = await supabase
        .from('media_library')
        .select(`
          *,
          buses(bus_number)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        // If table doesn't exist, show empty state
        if (error.code === '42P01') {
          console.log('media_library table does not exist yet');
          setMediaItems([]);
          return;
        }
        throw error;
      }

      const formattedData = data?.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        url: item.url,
        bus_id: item.bus_id,
        bus_number: item.buses?.bus_number,
        created_at: item.created_at,
        file_size: item.file_size
      })) || [];

      // De-duplicate by URL so the same file shows once in the library UI.
      // We keep the most recent row per URL and surface one bus_number if present.
      const byUrl = new Map<string, MediaItem>();
      for (const item of formattedData) {
        const existing = byUrl.get(item.url);
        if (!existing) {
          byUrl.set(item.url, item);
          continue;
        }
        // Prefer the most recently created
        const a = new Date(existing.created_at).getTime();
        const b = new Date(item.created_at).getTime();
        if (b > a) {
          byUrl.set(item.url, item);
        }
      }

      setMediaItems(Array.from(byUrl.values()));
    } catch (error) {
      console.error('Error fetching media items:', error);
      toast.error("Failed to load media items");
      setMediaItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuses = async () => {
    try {
      const { data, error } = await supabase
        .from('buses')
        .select('id, bus_number, route_name')
        .order('bus_number');

      if (error) throw error;
      setBuses(data || []);
    } catch (error) {
      console.error('Error fetching buses:', error);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use filename if no name provided
    const finalMediaName = mediaName.trim() || (selectedFile ? selectedFile.name : 'Video Link');
    
    if (!selectedFile && !videoLink.trim()) {
      toast.error("Please select a file or enter a video link");
      return;
    }

    setUploading(true);

    try {
      let mediaUrl = "";
      let mediaType: 'file' | 'link' = 'link';
      let fileSize = 0;

      if (selectedFile) {
        // Upload file to Supabase Storage
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('media-files')
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          if (uploadError.message.includes('Bucket not found')) {
            throw new Error('Media storage bucket does not exist. Please run the database migrations first.');
          }
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('media-files')
          .getPublicUrl(fileName);

        mediaUrl = urlData.publicUrl;
        mediaType = 'file';
        fileSize = selectedFile.size;
      } else {
        // Use video link
        mediaUrl = videoLink.trim();
        mediaType = 'link';
      }

      // Save to database
      const { error: insertError } = await supabase
        .from('media_library')
        .insert([{
          name: finalMediaName,
          type: mediaType,
          url: mediaUrl,
          bus_id: selectedBus === "none" ? null : selectedBus || null,
          file_size: fileSize
        }]);

      if (insertError) {
        console.error('Database insert error:', insertError);
        if (insertError.code === '42P01') {
          throw new Error('Media library table does not exist. Please run the database migrations first.');
        }
        throw insertError;
      }

      toast.success("Media uploaded successfully!");
      setUploadDialogOpen(false);
      resetForm();
      fetchMediaItems();
    } catch (error: any) {
      console.error('Error uploading media:', error);
      toast.error(error.message || "Failed to upload media");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setVideoLink(""); // Clear video link when file is selected
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setVideoLink("");
    }
  };

  const handleVideoLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoLink(e.target.value);
    if (e.target.value) {
      setSelectedFile(null); // Clear file when link is entered
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const resetForm = () => {
    setMediaName("");
    setSelectedBus("none");
    setVideoLink("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const deleteMedia = async (id: string, type: 'file' | 'link', url: string) => {
    try {
      // If it's a file, delete from storage first
      if (type === 'file') {
        const fileName = url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('media-files')
            .remove([fileName]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('media_library')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Media deleted successfully!");
      fetchMediaItems();
    } catch (error: any) {
      console.error('Error deleting media:', error);
      toast.error(error.message || "Failed to delete media");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isYouTubeLink = (url: string) => {
    return /(?:youtu\.be\/|youtube\.com\/)/i.test(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Media Library
            </h1>
            <p className="text-muted-foreground">
              Upload and manage videos and images for your buses
            </p>
          </div>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-primary to-primary-glow">
                <Plus className="w-4 h-4" />
                Add Media
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Add New Media</DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 pr-2">
                <form id="add-media-form" onSubmit={handleFileUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="media-name">Media Name</Label>
                    <Input
                      id="media-name"
                      placeholder="e.g., Promotional Video (optional - will use filename if empty)"
                      value={mediaName}
                      onChange={(e) => setMediaName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bus-select">Assign to Bus (Optional)</Label>
                    <Select value={selectedBus} onValueChange={setSelectedBus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a bus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No specific bus</SelectItem>
                        {buses.map((bus) => (
                          <SelectItem key={bus.id} value={bus.id}>
                            {bus.bus_number} - {bus.route_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label>Upload File</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept="video/*,image/*,.mp4,.avi,.mov,.wmv,.jpg,.jpeg,.png,.gif,.webp"
                          onChange={handleFileSelect}
                          className="flex-1"
                        />
                        <Upload className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Supported video: MP4, AVI, MOV, WMV — Supported image: JPG, PNG, GIF, WEBP
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Or Upload Image (quick)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
                          onChange={handleImageSelect}
                          className="flex-1"
                        />
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="text-center text-muted-foreground">OR</div>

                    <div className="space-y-2">
                      <Label htmlFor="video-link">Video Link</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="video-link"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={videoLink}
                          onChange={handleVideoLinkChange}
                          className="flex-1"
                        />
                        <Link className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        YouTube, Vimeo, or direct video links
                      </p>
                    </div>
                  </div>
                </form>
              </div>
              <DialogFooter className="flex-shrink-0 pt-4">
                <Button 
                  type="submit" 
                  form="add-media-form" 
                  className="w-full"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Add Media"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-40" />
              </Card>
            ))}
          </div>
        ) : mediaItems.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileVideo className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Media Yet</h3>
              <p className="text-muted-foreground mb-4">Upload your first video or add a video link</p>
              <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Media
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mediaItems.map((item, index) => (
              <Card 
                key={item.id} 
                className="group hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 border-primary/20 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-lg group-hover:scale-110 transition-transform">
                        {item.type === 'file' ? (
                          (/\.(jpg|jpeg|png|gif|webp)$/i.test(item.url) ? (
                            <ImageIcon className="w-5 h-5 text-primary-foreground" />
                          ) : (
                            <FileVideo className="w-5 h-5 text-primary-foreground" />
                          ))
                        ) : (
                          <ExternalLink className="w-5 h-5 text-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {item.type === 'file' ? ( /\.(jpg|jpeg|png|gif|webp)$/i.test(item.url) ? 'Uploaded Image' : 'Uploaded Video') : 'Video Link'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {item.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.bus_number && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Bus:</strong> {item.bus_number}
                    </div>
                  )}
                  
                  {item.type === 'file' && item.file_size && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Size:</strong> {formatFileSize(item.file_size)}
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    <strong>Created:</strong> {new Date(item.created_at).toLocaleDateString()}
                  </div>

                  {isYouTubeLink(item.url) && (
                    <div className="text-xs text-green-500 flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      YouTube Video
                    </div>
                  )}

                  <div className="pt-2 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => window.open(item.url, '_blank')}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-red-500 hover:text-red-700"
                      onClick={() => deleteMedia(item.id, item.type, item.url)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Media;


