'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, FileText, Brain, BarChart3, Download, Zap, Shield, Clock, Check } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Logo } from "@/components/ui/Logo"

export default function LandingPage() {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-emerald-100 to-emerald-50 px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-6 lg:space-y-8 px-2 sm:px-0">
            <div className="space-y-4 lg:space-y-6">
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-sm">
                AI-Powered Document Processing
              </Badge>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 leading-tight">
                Real Estate
                <br />
                <span className="text-emerald-600">Document Analysis</span>
                <br />
                Made Simple
              </h1>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-gray-500">What you get:</div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">Multi-Document Support - Process rent rolls, offering memos, lease agreements, and more</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">Intelligent Data Extraction - Extract tenant info, rental rates, and financial metrics with precision</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">Professional Excel Export - Generate formatted reports ready for stakeholders</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">Efficient Processing - Process documents up to 25MB in 2-3 minutes</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">Secure & Compliant - Enterprise-grade security with encrypted storage</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">Save Hours of Work - Reduce processing time from hours to minutes</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link href="/auth/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto px-6 sm:px-8 text-base sm:text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/auth/signin" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto px-6 sm:px-8 text-base sm:text-lg border-emerald-200 hover:bg-emerald-50">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden">
              {/* Dashboard Header */}
              <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-emerald-800 font-medium">Processing Document...</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="p-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-emerald-100">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-500">Total Properties</div>
                        <div className="text-2xl font-bold text-gray-900">1,247</div>
                        <div className="text-xs text-emerald-600">+12% from last month</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-100">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-500">Documents</div>
                        <div className="text-2xl font-bold text-gray-900">856</div>
                        <div className="text-xs text-emerald-600">+8% processed</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-100">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-500">Revenue</div>
                        <div className="text-2xl font-bold text-gray-900">$2.4M</div>
                        <div className="text-xs text-emerald-600">+15% growth</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Chart Area */}
                <Card className="border-emerald-100">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Document Processing</h3>
                        <Badge variant="secondary">Real-time</Badge>
                      </div>
                      <div className="h-32 bg-emerald-50 rounded-lg flex items-end justify-between p-4">
                        <div className="w-8 bg-emerald-200 rounded-t" style={{height: '60%'}}></div>
                        <div className="w-8 bg-emerald-300 rounded-t" style={{height: '80%'}}></div>
                        <div className="w-8 bg-emerald-400 rounded-t" style={{height: '40%'}}></div>
                        <div className="w-8 bg-emerald-500 rounded-t" style={{height: '90%'}}></div>
                        <div className="w-8 bg-emerald-600 rounded-t" style={{height: '70%'}}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Recent Documents</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 p-3 bg-emerald-50 rounded-lg">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Rent Roll - 123 Main St</div>
                        <div className="text-xs text-gray-500">Processed 2 minutes ago</div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800">Complete</Badge>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Offering Memo - Downtown Plaza</div>
                        <div className="text-xs text-gray-500">Processing...</div>
                      </div>
                      <Badge variant="secondary">In Progress</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Document Types Section */}
      <section className="bg-white py-12 sm:py-16 lg:py-24 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 lg:space-y-6 mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Documents We Process</h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              Our AI extracts structured data from all major real estate document types
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Rent Roll */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Rent Roll</h3>
                <p className="text-sm text-gray-600">
                  Extract tenant names, unit numbers, lease dates, rent amounts, deposits, and occupancy status
                </p>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-emerald-600">Output: Excel with tenant data, lease terms, rent schedules</p>
                </div>
              </CardContent>
            </Card>

            {/* Offering Memo */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Offering Memo</h3>
                <p className="text-sm text-gray-600">
                  Extract property details, financial highlights, location info, cap rate, NOI, and investment metrics
                </p>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-blue-600">Output: Structured financial summary, property highlights</p>
                </div>
              </CardContent>
            </Card>

            {/* Lease Agreement */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Lease Agreement</h3>
                <p className="text-sm text-gray-600">
                  Extract lease terms, rent escalations, tenant obligations, renewal options, and key dates
                </p>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-purple-600">Output: Lease terms summary, obligation checklist</p>
                </div>
              </CardContent>
            </Card>

            {/* Financial Statements */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Financial Statements</h3>
                <p className="text-sm text-gray-600">
                  Extract income, expenses, NOI, cash flow, operating ratios, and year-over-year comparisons
                </p>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-orange-600">Output: P&L summary, key financial metrics</p>
                </div>
              </CardContent>
            </Card>

            {/* Operating Budget */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-teal-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Operating Budget</h3>
                <p className="text-sm text-gray-600">
                  Extract budget categories, projected income, operating expenses, capital expenditures, and variances
                </p>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-teal-600">Output: Budget breakdown, expense categories</p>
                </div>
              </CardContent>
            </Card>

            {/* Broker Comparables */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Broker Comparables</h3>
                <p className="text-sm text-gray-600">
                  Extract comp properties, sale prices, price per SF, cap rates, NOI, and market trends for sales & leases
                </p>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-indigo-600">Output: Comparable analysis, market data table</p>
                </div>
              </CardContent>
            </Card>

            {/* Broker Listing */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-pink-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Broker Listing</h3>
                <p className="text-sm text-gray-600">
                  Extract listing price, property features, square footage, zoning, amenities, and broker contact info
                </p>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-pink-600">Output: Property details, listing specifications</p>
                </div>
              </CardContent>
            </Card>

            {/* More Document Types */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-gray-50 to-white">
              <CardContent className="p-6 space-y-4 flex flex-col justify-center items-center text-center h-full">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">More Coming Soon</h3>
                <p className="text-sm text-gray-600">
                  We're constantly adding support for new document types based on customer feedback
                </p>
                <a href="mailto:support@rexeli.com" className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                  Request a document type →
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-gray-50 py-12 sm:py-16 lg:py-24 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 lg:space-y-6 mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Simple, Transparent Pricing</h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              Choose the plan that fits your needs. No hidden fees, cancel anytime.
            </p>
          </div>

          <Tabs defaultValue="monthly" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual (-20%)</TabsTrigger>
              <TabsTrigger value="payg">One-Time Purchase</TabsTrigger>
            </TabsList>

            {/* Monthly Plans */}
            <TabsContent value="monthly" className="space-y-8">
              <div className="text-center mb-6">
                <Badge className="bg-emerald-100 text-emerald-800 text-sm px-4 py-2">
                  Flexible monthly billing - Cancel anytime, no commitments required
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Entrepreneur Plan */}
                <Card className="border-gray-200 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Entrepreneur</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900">$19</span>
                        <span className="text-gray-500">/mo</span>
                      </div>
                      <p className="text-sm text-emerald-600 font-medium">$0.38 per document</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">50 documents/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">1 user included</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">$0.75 per extra doc</span>
                      </div>
                    </div>

                    <Link href="/auth/signup">
                      <Button variant="outline" className="w-full">Get Started</Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Professional Plan */}
                <Card className="border-emerald-500 border-2 hover:shadow-xl transition-shadow relative">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-emerald-600 text-white px-4 py-1">Most Popular</Badge>
                  </div>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Professional</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900">$119</span>
                        <span className="text-gray-500">/mo</span>
                      </div>
                      <p className="text-sm text-emerald-600 font-medium">$0.40 per document</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">300 documents/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">3 users included</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">$0.55 per extra doc</span>
                      </div>
                    </div>

                    <Link href="/auth/signup">
                      <Button className="w-full">Get Started</Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Business Plan */}
                <Card className="border-gray-200 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Business</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900">$389</span>
                        <span className="text-gray-500">/mo</span>
                      </div>
                      <p className="text-sm text-emerald-600 font-medium">$0.26 per document</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">1,500 documents/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">10 users included</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">$0.35 per extra doc</span>
                      </div>
                    </div>

                    <Link href="/auth/signup">
                      <Button variant="outline" className="w-full">Get Started</Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Enterprise Plan */}
                <Card className="border-gray-200 hover:shadow-lg transition-shadow bg-gradient-to-br from-gray-50 to-white">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Enterprise</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900">Custom</span>
                      </div>
                      <p className="text-sm text-gray-600">For large organizations</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">10,000+ documents/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">Unlimited users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">Negotiated pricing</span>
                      </div>
                    </div>

                    <a href="mailto:sales@rexeli.com">
                      <Button variant="outline" className="w-full">Contact Sales</Button>
                    </a>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Annual Plans */}
            <TabsContent value="annual" className="space-y-8">
              <div className="text-center mb-6">
                <Badge className="bg-emerald-100 text-emerald-800 text-sm px-4 py-2">
                  Save 20% with annual billing - Best value for committed teams
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Entrepreneur Annual */}
                <Card className="border-gray-200 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Entrepreneur</h3>
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-gray-900">$182</span>
                          <span className="text-gray-500">/yr</span>
                        </div>
                        <p className="text-sm text-emerald-600 font-medium">$15/mo effective</p>
                        <p className="text-xs text-gray-500">Save $46/year</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">50 documents/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">1 user included</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">Paid annually</span>
                      </div>
                    </div>

                    <Link href="/auth/signup">
                      <Button variant="outline" className="w-full">Get Started</Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Professional Annual */}
                <Card className="border-emerald-500 border-2 hover:shadow-xl transition-shadow relative">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-emerald-600 text-white px-4 py-1">Most Popular</Badge>
                  </div>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Professional</h3>
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-gray-900">$1,142</span>
                          <span className="text-gray-500">/yr</span>
                        </div>
                        <p className="text-sm text-emerald-600 font-medium">$95/mo effective</p>
                        <p className="text-xs text-gray-500">Save $286/year</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">300 documents/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">3 users included</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">Paid annually</span>
                      </div>
                    </div>

                    <Link href="/auth/signup">
                      <Button className="w-full">Get Started</Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Business Annual */}
                <Card className="border-gray-200 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Business</h3>
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-gray-900">$3,734</span>
                          <span className="text-gray-500">/yr</span>
                        </div>
                        <p className="text-sm text-emerald-600 font-medium">$311/mo effective</p>
                        <p className="text-xs text-gray-500">Save $934/year</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">1,500 documents/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">10 users included</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">Paid annually</span>
                      </div>
                    </div>

                    <Link href="/auth/signup">
                      <Button variant="outline" className="w-full">Get Started</Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Enterprise Annual */}
                <Card className="border-gray-200 hover:shadow-lg transition-shadow bg-gradient-to-br from-gray-50 to-white">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Enterprise</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900">Custom</span>
                      </div>
                      <p className="text-sm text-gray-600">Annual contract</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">10,000+ documents/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">Unlimited users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">Custom savings</span>
                      </div>
                    </div>

                    <a href="mailto:sales@rexeli.com">
                      <Button variant="outline" className="w-full">Contact Sales</Button>
                    </a>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* One-Time Purchase Plans */}
            <TabsContent value="payg" className="space-y-8">
              <div className="text-center mb-6">
                <Badge className="bg-blue-100 text-blue-800 text-sm px-4 py-2">
                  One-time payment, no recurring charges - Perfect for occasional use
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Entrepreneur Pack */}
                <Card className="border-gray-200 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Entrepreneur Pack</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900">$39</span>
                      </div>
                      <p className="text-sm text-gray-600">One-time payment</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">50 documents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">1 user</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">$0.78 per doc</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">90 day expiration</span>
                      </div>
                    </div>

                    <Link href="/auth/signup">
                      <Button variant="outline" className="w-full">Buy Now</Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Professional Pack */}
                <Card className="border-blue-500 border-2 hover:shadow-xl transition-shadow relative">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white px-4 py-1">Best Value</Badge>
                  </div>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Professional Pack</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900">$149</span>
                      </div>
                      <p className="text-sm text-gray-600">One-time payment</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">250 documents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">3 users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-semibold">$0.60 per doc</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">6 month expiration</span>
                      </div>
                    </div>

                    <Link href="/auth/signup">
                      <Button className="w-full">Buy Now</Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Business Pack */}
                <Card className="border-gray-200 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Business Pack</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900">$539</span>
                      </div>
                      <p className="text-sm text-gray-600">One-time payment</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">1,250 documents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">5 users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">$0.43 per doc</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">12 month expiration</span>
                      </div>
                    </div>

                    <Link href="/auth/signup">
                      <Button variant="outline" className="w-full">Buy Now</Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Enterprise Pack */}
                <Card className="border-gray-200 hover:shadow-lg transition-shadow bg-gradient-to-br from-gray-50 to-white">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Enterprise Pack</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900">Custom</span>
                      </div>
                      <p className="text-sm text-gray-600">Tailored for you</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">10,000+ documents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">Unlimited users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">$0.50-$0.69 per doc</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm">12 mo+ or no expiration</span>
                      </div>
                    </div>

                    <a href="mailto:sales@rexeli.com">
                      <Button variant="outline" className="w-full">Contact Sales</Button>
                    </a>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gradient-to-br from-gray-50 to-slate-50 py-12 sm:py-16 lg:py-24 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 lg:space-y-6 mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Trusted by Real Estate Professionals</h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              See what our users are saying about RExeli
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Testimonial 1 */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] card-hover">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-1 text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 italic">&quot;RExeli has transformed how we process rent rolls. What used to take hours now takes minutes!&quot;</p>
                <div className="flex items-center space-x-3 pt-4 border-t border-gray-100">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    S
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Sarah Johnson</p>
                    <p className="text-sm text-gray-500">Property Manager, NYC</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Testimonial 2 */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] card-hover">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-1 text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 italic">&quot;The AI accuracy is incredible. It extracts data from complex documents that would take my team days to process manually.&quot;</p>
                <div className="flex items-center space-x-3 pt-4 border-t border-gray-100">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    M
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Michael Chen</p>
                    <p className="text-sm text-gray-500">Investment Analyst</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Testimonial 3 */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] card-hover">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-1 text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 italic">&quot;Easy to use, fast, and reliable. RExeli has become an essential tool for our brokerage firm.&quot;</p>
                <div className="flex items-center space-x-3 pt-4 border-t border-gray-100">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    E
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Emily Rodriguez</p>
                    <p className="text-sm text-gray-500">Commercial Broker</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-12 sm:py-16 lg:py-24 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-6 lg:space-y-8">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-foreground">
              Ready to Transform Your Document Processing?
            </h2>
            <p className="text-lg sm:text-xl text-primary-foreground/80 max-w-3xl mx-auto">
              Join real estate professionals who are already saving hours with RExeli&apos;s AI-powered document analysis.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <Link href="/auth/signup">
                <Button
                  variant="inverted"
                  size="lg"
                  className="px-6 sm:px-8 w-full sm:w-auto"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <a href="mailto:sales@rexeli.com">
                <Button
                  variant="contrast"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Contact Sales
                </Button>
              </a>
            </div>
            <p className="text-sm text-primary-foreground/70 mt-4">
              Questions? Email us at{' '}
              <a href="mailto:support@rexeli.com" className="text-primary-foreground underline hover:text-primary-foreground/90">
                support@rexeli.com
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}