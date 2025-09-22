import FileUpload from '@/components/upload/FileUpload'
import DocumentPreview from '@/components/preview/DocumentPreview'
import ProcessingWorkflow from '@/components/processing/ProcessingWorkflow'
import ResultsDisplay from '@/components/results/ResultsDisplay'
import { Button } from "@/components/ui/button"
import { FileText, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ToolPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      {/* Header */}
      <header className="border-b border-emerald-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-emerald-600">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">RExeli</h1>
              <span className="text-sm text-gray-500">Document Processor</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" className="border-emerald-200 text-emerald-600 hover:bg-emerald-50">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Upload and Preview */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-emerald-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Document</h2>
              <FileUpload />
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-emerald-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Preview</h2>
              <DocumentPreview />
            </div>
          </div>

          {/* Right Column - Processing and Results */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-emerald-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Processing</h2>
              <ProcessingWorkflow />
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-emerald-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Extracted Data</h2>
              <ResultsDisplay />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}