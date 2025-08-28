# RExeli V1 - Real Estate Document Processing System

![RExeli Logo](https://via.placeholder.com/150x50/007bff/ffffff?text=RExeli)

A modern, AI-powered real estate document processing platform built with Next.js 14, OpenAI Vision API, and Supabase. Extract structured data from commercial real estate documents including rent rolls, offering memos, lease agreements, and more.

## 🚀 Features

### Core Functionality
- **AI Document Classification**: Automatically identify document types using OpenAI Vision API
- **Intelligent Data Extraction**: Extract structured data from complex real estate documents
- **Professional UI**: Clean, intuitive interface built with Tailwind CSS and shadcn/ui
- **Excel Export**: Generate formatted Excel spreadsheets with extracted data
- **Real-time Processing**: Live workflow visualization with progress tracking
- **Large File Support**: Handle documents up to 25MB in size

### Supported Document Types
- **Rent Rolls**: Tenant information, rental rates, lease terms, occupancy data
- **Offering Memos**: Property details, financial projections, investment highlights
- **Lease Agreements**: Lease terms, rental rates, tenant information
- **Comparable Sales**: Market data, property sales information
- **Financial Statements**: Income/expense statements, NOI calculations

### Technical Features
- Next.js 14 with App Router and TypeScript
- OpenAI GPT-4o Vision for document analysis
- Supabase for secure file storage
- Drag & drop file upload with progress tracking
- PDF preview and document viewer
- Responsive design for desktop and mobile
- Error handling and user feedback
- Clean architecture with type safety

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/rexeli/rexeli-v1.git
cd rexeli-v1
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI Configuration  
OPENAI_API_KEY=your_openai_api_key
```

4. **Set up Supabase storage bucket**
Create a storage bucket named `documents` in your Supabase dashboard with public access.

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── api/               # API Routes
│   │   ├── upload/        # File upload endpoint
│   │   ├── classify/      # Document classification
│   │   ├── extract/       # Data extraction
│   │   └── export/        # Excel export
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Main application page
│   └── globals.css       # Global styles
├── components/            # React Components
│   ├── upload/           # File upload components
│   ├── preview/          # Document preview
│   ├── processing/       # AI processing workflow
│   ├── results/          # Results display
│   └── ui/              # shadcn/ui components
├── lib/                  # Core Libraries
│   ├── supabase.ts      # Supabase client
│   ├── openai.ts        # OpenAI integration
│   ├── types.ts         # TypeScript definitions
│   └── utils.ts         # Utility functions
public/                   # Static assets
```

## 🔧 Configuration

### Supabase Setup

1. Create a new Supabase project
2. Create a storage bucket named `documents`
3. Set bucket permissions to allow public uploads
4. Add your Supabase URL and anon key to `.env.local`

### OpenAI Setup

1. Get an API key from [OpenAI](https://platform.openai.com)
2. Ensure you have access to GPT-4o Vision
3. Add your API key to `.env.local`

## 📖 API Documentation

### File Upload
**POST** `/api/upload`
- Accepts multipart/form-data with file
- Returns Supabase storage URL
- Supports PDF, JPEG, PNG up to 25MB

### Document Classification  
**POST** `/api/classify`
- Analyzes document using OpenAI Vision
- Returns document type and confidence score
- Supported types: rent_roll, offering_memo, lease_agreement, comparable_sales, financial_statement

### Data Extraction
**POST** `/api/extract` 
- Extracts structured data from classified documents
- Returns JSON with property information and structured data
- Uses specialized prompts for each document type

### Excel Export
**POST** `/api/export`
- Generates Excel file from extracted data
- Returns downloadable file with formatted sheets
- Includes summaries, details, and charts

## 🎯 Usage Examples

### Basic Workflow
1. Upload a real estate document (PDF, JPEG, or PNG)
2. Preview the document in the interface
3. Click "Start AI Processing" to begin analysis
4. Monitor the 5-step processing workflow
5. Review extracted data in structured format
6. Export results to Excel spreadsheet

### Document Types

**Rent Roll Processing**
- Extracts tenant information, unit numbers, rental rates
- Calculates occupancy rates and rent per square foot
- Generates tenant roster and financial summary

**Offering Memo Analysis**  
- Identifies property details and financial metrics
- Extracts asking price, cap rate, NOI
- Compiles property highlights and features

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Connect to Vercel**
```bash
npm install -g vercel
vercel login
vercel
```

2. **Set Environment Variables**
In the Vercel dashboard, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
- `OPENAI_API_KEY`

3. **Deploy**
```bash
vercel --prod
```

### Alternative Deployment Options
- **Docker**: Use provided Dockerfile
- **Netlify**: Enable Next.js build settings
- **Self-hosted**: Use `npm run build && npm run start`

## 🔐 Security

- All API routes include proper error handling
- File uploads are validated for type and size
- Supabase provides row-level security
- API keys are server-side only
- Input sanitization on all endpoints

## 📊 Performance

- Optimized for large file uploads (25MB+)
- Lazy loading of components
- Image optimization with Next.js
- CDN delivery via Supabase
- Efficient Excel generation with ExcelJS

## 🧪 Testing

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Documentation**: [docs.rexeli.com](https://docs.rexeli.com)
- **Email**: support@rexeli.com
- **Issues**: [GitHub Issues](https://github.com/rexeli/rexeli-v1/issues)

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for GPT-4o Vision API
- [Supabase](https://supabase.com) for backend infrastructure
- [Vercel](https://vercel.com) for hosting platform
- [shadcn/ui](https://ui.shadcn.com) for component library
- [Tailwind CSS](https://tailwindcss.com) for styling

---

**RExeli V1** - Transforming real estate document processing with AI

Built with ❤️ for the commercial real estate industry.
