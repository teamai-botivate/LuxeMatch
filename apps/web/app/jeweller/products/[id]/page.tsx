'use client';

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion } from "motion/react";
import { ImagePlus, X, Star, ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import JewellerLayout from "@/components/layout/JewellerLayout";
import TryOnAssetCalibrator from "@/components/jeweller/TryOnAssetCalibrator";
import { getProductById } from "@/lib/mock-data";
import NotFoundView from "@/components/ui/NotFoundView";

const CATEGORIES = ["Necklace", "Earrings", "Ring", "Bangle", "Pendant", "Choker"];
const METALS = ["Gold", "Silver", "Platinum", "Rose Gold", "White Gold"];
const PURITIES = ["22K", "18K", "14K", "925", "950"];
const OCCASION_OPTIONS = ["Wedding", "Daily Wear", "Festival", "Anniversary", "Gift"];

interface FormValues {
  name: string;
  category: string;
  metal: string;
  purity: string;
  gemstones: string;
  styleTags: string;
  priceMin: string;
  priceMax: string;
  weight: string;
  description: string;
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const product = getProductById(id ?? "");

  const [occasions, setOccasions] = useState<string[]>(product?.occasions ?? []);
  const [primaryIndex, setPrimaryIndex] = useState(0);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: product ? {
      name: product.name,
      category: product.category,
      metal: product.metal,
      purity: product.purity,
      gemstones: product.gemstones ?? "",
      styleTags: product.styleTags?.join(", ") ?? "",
      priceMin: String(product.price),
      priceMax: product.originalPrice ? String(product.originalPrice) : "",
      weight: product.weight ?? "",
      description: product.description,
    } : {},
  });

  if (!product) return <NotFoundView />;

  const toggleOccasion = (occ: string) => {
    setOccasions(prev => prev.includes(occ) ? prev.filter(o => o !== occ) : [...prev, occ]);
  };

  const onSubmit = (_data: FormValues) => {
    toast({ title: "Product updated", description: `${product.name} has been updated successfully.` });
    router.push("/jeweller/products");
  };

  const handleDelete = () => {
    toast({ title: "Product deleted", description: `${product.name} has been removed.`, variant: "destructive" });
    router.push("/jeweller/products");
  };

  const handleReindex = () => {
    toast({ title: "Product queued for search reindex", description: "Changes will appear in search results shortly." });
  };

  return (
    <JewellerLayout>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} data-testid="edit-product-page">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/jeweller/products")} className="p-2 rounded-xl hover:bg-accent transition-colors">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <h1 className="text-2xl font-medium tracking-tight line-clamp-1">Edit: {product.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full text-sm gap-2"
              onClick={handleReindex}
              data-testid="button-reindex"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reindex
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="rounded-full text-sm gap-2 border-destructive/30 text-destructive hover:bg-destructive/10" data-testid="button-delete">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Product</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{product.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                    data-testid="button-confirm-delete"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* LEFT — Form fields */}
            <div className="space-y-5">
              <div>
                <Label htmlFor="name" className="text-xs font-semibold mb-1.5 block">Product Name <span className="text-destructive">*</span></Label>
                <Input id="name" className="rounded-xl" {...register("name", { required: "Product name is required" })} data-testid="input-name" />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Category <span className="text-destructive">*</span></Label>
                  <Select defaultValue={product.category} onValueChange={v => setValue("category", v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Metal <span className="text-destructive">*</span></Label>
                  <Select defaultValue={product.metal} onValueChange={v => setValue("metal", v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Purity <span className="text-destructive">*</span></Label>
                  <Select defaultValue={product.purity} onValueChange={v => setValue("purity", v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PURITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="weight" className="text-xs font-semibold mb-1.5 block">Weight (g)</Label>
                  <Input id="weight" className="rounded-xl" {...register("weight")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="priceMin" className="text-xs font-semibold mb-1.5 block">Min Price (₹) <span className="text-destructive">*</span></Label>
                  <Input id="priceMin" type="number" className="rounded-xl" {...register("priceMin", { required: "Required" })} data-testid="input-price-min" />
                  {errors.priceMin && <p className="text-xs text-destructive mt-1">{errors.priceMin.message}</p>}
                </div>
                <div>
                  <Label htmlFor="priceMax" className="text-xs font-semibold mb-1.5 block">Max Price (₹)</Label>
                  <Input id="priceMax" type="number" className="rounded-xl" {...register("priceMax")} />
                </div>
              </div>

              <div>
                <Label htmlFor="gemstones" className="text-xs font-semibold mb-1.5 block">Gemstones</Label>
                <Input id="gemstones" className="rounded-xl" {...register("gemstones")} />
              </div>
              <div>
                <Label htmlFor="styleTags" className="text-xs font-semibold mb-1.5 block">Style Tags</Label>
                <Input id="styleTags" placeholder="comma separated" className="rounded-xl" {...register("styleTags")} />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block">Occasion Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {OCCASION_OPTIONS.map(occ => (
                    <label key={occ} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={occasions.includes(occ)} onCheckedChange={() => toggleOccasion(occ)} />
                      <span className="text-sm">{occ}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-xs font-semibold mb-1.5 block">Description</Label>
                <Textarea id="description" rows={4} className="rounded-xl resize-none" {...register("description")} />
              </div>
            </div>

            {/* RIGHT — Images */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">Product Images</h3>
                <div className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center gap-3 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Drop images here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP up to 10MB each</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4 flex-wrap">
                  {product.images.map((img, i) => (
                    <div key={img.id} className="relative">
                      <img src={img.url} alt={img.alt} className="w-20 h-20 object-cover rounded-xl border-2 border-border" />
                      {i === primaryIndex && (
                        <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Star className="w-2.5 h-2.5 text-primary-foreground fill-current" />
                        </span>
                      )}
                      {i !== primaryIndex && (
                        <button
                          type="button"
                          onClick={() => setPrimaryIndex(i)}
                          className="absolute bottom-1 left-1 right-1 text-[9px] font-semibold bg-black/50 text-white/80 rounded px-1 py-0.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          Set primary
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Try-On Asset Calibration — real, Supabase-backed */}
              <TryOnAssetCalibrator productId={id ?? ''} />
            </div>
          </div>

          {/* Form actions */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-border">
            <Button type="button" variant="outline" className="rounded-full px-6" onClick={() => router.push("/jeweller/products")} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" className="rounded-full px-6 bg-primary text-primary-foreground hover:opacity-90" data-testid="button-save-product">
              Save Changes
            </Button>
          </div>
        </form>
      </motion.div>
    </JewellerLayout>
  );
}
