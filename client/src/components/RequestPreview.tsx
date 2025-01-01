import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { FileIcon, Loader2 } from "lucide-react";

interface RequestData {
  id: number;
  title: string;
  status: string;
  description: string;
  purposeType: string;
  priority: string;
  items: {
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
  }[];
  attachments?: {
    id: number;
    fileName: string;
    fileType: string;
  }[];
  currency: string;
  totalEstimatedCost: number;
  freightAmount: number;
}

interface FilePreviewProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
}

const FilePreview = ({ fileUrl, fileName, fileType }: FilePreviewProps) => {
  const isImage = fileType.startsWith('image/');

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-white">
      {isImage ? (
        <img
          src={fileUrl}
          alt={fileName}
          className="w-full h-48 object-contain rounded-md"
        />
      ) : (
        <div className="w-full h-48 flex items-center justify-center bg-gray-50 rounded-md">
          <FileIcon className="w-12 h-12 text-gray-400" />
          <span className="text-lg font-medium text-gray-500 ml-2">
            {fileName.split('.').pop()?.toUpperCase()}
          </span>
        </div>
      )}
      <p className="text-sm font-medium truncate">{fileName}</p>
    </div>
  );
};

interface RequestPreviewProps {
  requestId: number;
  open: boolean;
  onClose: () => void;
}

export default function RequestPreview({
  requestId,
  open,
  onClose,
}: RequestPreviewProps) {
  const { data: request, isLoading } = useQuery<RequestData>({
    queryKey: [`/api/requests/${requestId}`],
    enabled: open,
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Request Preview</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !request ? (
          <div className="py-4 text-center text-gray-500">
            Request not found or failed to load
          </div>
        ) : (
          <div className="space-y-6">
            {/* Request Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold">Title</h3>
                <p>{request.title}</p>
              </div>
              <div>
                <h3 className="font-semibold">Status</h3>
                <p className="capitalize">{request.status}</p>
              </div>
              <div>
                <h3 className="font-semibold">Purpose Type</h3>
                <p>{request.purposeType}</p>
              </div>
              <div>
                <h3 className="font-semibold">Priority</h3>
                <p className="capitalize">{request.priority}</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="font-semibold">Description</h3>
              <p className="whitespace-pre-wrap">{request.description}</p>
            </div>

            {/* Items */}
            <div>
              <h3 className="font-semibold mb-2">Items</h3>
              <div className="space-y-2">
                {request.items.map((item, index) => (
                  <div key={index} className="border rounded p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-medium">Name:</span> {item.name}
                      </div>
                      <div>
                        <span className="font-medium">Quantity:</span>{" "}
                        {item.quantity}
                      </div>
                      <div>
                        <span className="font-medium">Cost:</span>{" "}
                        {item.estimatedCost}
                      </div>
                    </div>
                    {item.description && (
                      <div className="mt-2">
                        <span className="font-medium">Description:</span>{" "}
                        {item.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Attachments */}
            {request.attachments && request.attachments.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Attachments</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {request.attachments.map((file, index) => (
                    <FilePreview
                      key={index}
                      fileUrl={`/api/attachments/${file.id}`}
                      fileName={file.fileName}
                      fileType={file.fileType}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Total Cost */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold">Total Cost:</span>{" "}
                  <span className="text-lg">
                    {request.currency} {request.totalEstimatedCost?.toFixed(2)}
                  </span>
                </div>
                {request.freightAmount > 0 && (
                  <div>
                    <span className="font-semibold">Freight Amount:</span>{" "}
                    <span>{request.currency} {request.freightAmount?.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}