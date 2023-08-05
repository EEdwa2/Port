import { jsonSchema, uuid } from "uuidv4";
import { downloadAttachmentAndSaveToS3, downloadFile } from "../utils/utils"
import fs from "fs"
import { MessageAuthorEntity} from "../entities/message-author.entity"
import { MessageEntity } from "../entities/message.entity"
import { AttachmentEntity } from "../entities/attachment.entity"
const axios = require("axios");
import { request, gql } from 'graphql-request'
import { AppDataSource, attachmentRepository, messageRepository } from "../database";

const SINCE_DATE = new Date(2022, 10, 31)

interface Author {
    id: string,
    username: string,
    bio: string | null, 
    imageId:string
  }

interface Post {
    id: string, 
    firstPublishedAt: number, 
    latestPublishedAt:number,
    mediumUrl: string
    creator: Author,
    title: string | null

}
  

export async function startMediumParser(links: string[]) {

    if (!fs.existsSync("./images")) {
		fs.mkdirSync("./images")
	}
	if (!fs.existsSync("./images/medium")) {
		fs.mkdirSync("./images/medium")
	}

    if (!fs.existsSync("./images/medium/attachments")) {
		fs.mkdirSync("./images/medium/attachments")
	}

    while (true) {
        await getArticleFromLink(links)
        await new Promise(resolve => setTimeout(resolve, 120000))
      }

}

async function getArticleFromLink(links: string[]) {
    for (const link of links) {
        const username = await getUsernameFromLink(link)
        const firstPage = await corporatAccountVerification(link)
        const firstPageDate = firstPage.data
        let graphqlPosts:any = null
        const allPosts: any = []
        let lastArticleId = null
        let reachedSinceDate = false
        let reachedLastSaved = false
        if (username) {
            if (firstPageDate.indexOf("collection(") > 0) {
                const newData = firstPageDate.split("collection(")
                const collectionId = newData[1].substr(10, 12)
                
                while (true){
                    const lastSaved: MessageEntity | undefined = await messageRepository
                    .find({
                        where: {
                            author: {
                                username: username
                            },
                        },
                        skip: 0,
                        take: 1,
                        order: { createdTimestamp: "DESC" },
                    })
                    .then(result => result[0])

                    graphqlPosts = await mediumQueryForCorpAcc(collectionId, lastArticleId, username)
                    

                    const postsFromgraphq = graphqlPosts.collection.homepagePostsConnection.posts
                    
                    for (const post of postsFromgraphq) {
                        if (post.id === lastSaved?.id) {
                            reachedLastSaved = true
                            break
                        } else 
                        if (
                            post.firstPublishedAt < SINCE_DATE.getTime()
                        ) {
                            reachedSinceDate = true
                            break
                        } else {
                            allPosts.push(post)
                        }
                    }
                    
                    
                    if(graphqlPosts.collection.homepagePostsConnection.pagingInfo.next === null) {
                        lastArticleId = null
                    } else{
                        lastArticleId = graphqlPosts.collection.homepagePostsConnection.pagingInfo.next.from;
                    }
        
                    if (graphqlPosts.collection.homepagePostsConnection.posts < 10 ||  lastArticleId === null) break
                }
                for (const post of allPosts) {
                
                    await getInfoFromArticle(post)
                }
            }
            else if (username.indexOf("-") > 0){
                let page = 1
                let counter = 0
                while (true){
                    const lastSaved: MessageEntity | undefined = await messageRepository
                    .find({
                        where: {
                            author: {
                                username: username
                            },
                        },
                        skip: 0,
                        take: 1,
                        order: { createdTimestamp: "DESC" },
                    })
                    .then(result => result[0])

                    let postCounter = 0 
                    const graphqlPostsTest = await corporatAccountVerification(link)
                    const userIdForRequest = graphqlPostsTest.data.split(':{"collection":{"id":')[1].substr(1, 12)
                    const streamRequest = await axios.get(`https://medium.com/_/api/collections/${userIdForRequest}/stream?to=1668767931215&page=${page}`,{
                        headers: {
                            "content-type": "json",
                        }
                    })
                    const  streamRequestJSON = JSON.parse(streamRequest.data.split("}while(1);</x>")[1])
                    const postsInJSON = streamRequestJSON.payload.references.Post
                    const usersInJSON = streamRequestJSON.payload.references.User
                    let postElement: any = {}
                    let postsFromRequest: any = []

                    for (const postKey in postsInJSON) {
                        if (postsInJSON.hasOwnProperty(postKey)) {
                            postElement = postsInJSON[postKey];
            
                            for (const userKey in usersInJSON) {
                                postElement.mediumUrl = link + "/" + postElement.id
                                if (usersInJSON.hasOwnProperty(userKey)) {
                                    const userElement = usersInJSON[userKey];
                                    if (userElement.userId == postElement.creatorId){
                                        postElement.creator = userElement
                                    } else{
                                        break
                                    }
                                }
                            }
                            postsFromRequest.push(postElement)
                            counter++
                            postCounter++
                        }
                        
                    }
                    for (const post of postsFromRequest) {
                        if (post.id === lastSaved?.id) {
                            reachedLastSaved = true
                            break
                        } else 
                        if (
                            post.firstPublishedAt < SINCE_DATE.getTime()
                        ) {
                            reachedSinceDate = true
                            break
                        }        
                    }
                    Array.prototype.push.apply(allPosts, postsFromRequest)
                    console.log(counter);
                    

                    if (postCounter < 25){
                        break
                    }else {
                        page++
                    }
                }
                for (const post of allPosts) {
                    await getInfoFromArticle(post)
        
                }
            }
            else {
                while (true){
                    const lastSaved: MessageEntity | undefined = await messageRepository
                    .find({
                        where: {
                            author: {
                                username: username
                            },
                        },
                        skip: 0,
                        take: 1,
                        order: { createdTimestamp: "DESC" },
                    })
                    .then(result => result[0])
                    console.log(1213);
                    
                        graphqlPosts = await mediumQuery(lastArticleId, username)
                        
                    const postsFromgraphq = graphqlPosts.userResult.homepagePostsConnection.posts
                    
                    for (const post of postsFromgraphq) {
                        if (post.id === lastSaved?.id) {
                            reachedLastSaved = true
                            break
                        } else 
                        if (
                            post.firstPublishedAt < SINCE_DATE.getTime()
                        ) {
                            reachedSinceDate = true
                            break
                        } else {
                            allPosts.push(post)
                        }
                        
                    }
                    if(graphqlPosts.userResult.homepagePostsConnection.pagingInfo.next === null) {
                        lastArticleId = null
                    } else{
                        lastArticleId = graphqlPosts.userResult.homepagePostsConnection.pagingInfo.next.from;
                    }
        
                    if (graphqlPosts.userResult.homepagePostsConnection.posts < 10 ||  lastArticleId === null) break
                }
                
                for (const post of allPosts) {
                    await getInfoFromArticle(post)
        
                }
            } 
        }
    }
}
async function getUsernameFromLink(link: string) {
    const stateLink = link.split("https://")[1]

    if (stateLink.indexOf("medium.com/") === 0) {
        const username = stateLink.split("medium.com/")[1]
        return username
    }
    else if (stateLink.indexOf("medium.com/") > 0) {
        const username = stateLink.split(".medium.com/")[0]
        return username
    }
    
}

async function corporatAccountVerification (link: string) {
    const requestFromPage = await axios.get(link)    
    return requestFromPage
}




const mediumQuery = async (lastId: string | null, username: string) => {
    const query = gql`query UserProfileQuery($id: ID, $username: ID, $homepagePostsLimit: PaginationLimit, $homepagePostsFrom: String = null, $includeDistributedResponses: Boolean = true)
	{  userResult(id: $id, username: $username) {    __typename    ... on User {      id      name      viewerIsUser      viewerEdge {        id        isFollowing        __typename      }      homePostsPublished: homepagePostsConnection(paging: {limit: 1}) {        posts {          id          __typename        }        __typename      }      ...UserCanonicalizer_user      ...UserProfileScreen_user      ...EntityDrivenSubscriptionLandingPageScreen_writer      ...useShouldShowEntityDrivenSubscription_creator      __typename    }  }}fragment UserCanonicalizer_user on User {  id  username  hasSubdomain  customDomainState {    live {      domain      __typename    }    __typename  }  __typename}fragment UserProfileScreen_user on User 
    {  __typename  id  viewerIsUser  ...PublisherHeader_publisher  ...PublisherHomepagePosts_publisher  ...UserSubdomainFlow_user  ...UserProfileMetadata_user  ...SuspendedBannerLoader_user  ...useAnalytics_user}fragment PublisherHeader_publisher on Publisher {  id  ...PublisherHeaderBackground_publisher  ...PublisherHeaderNameplate_publisher  ...PublisherHeaderActions_publisher  ...PublisherHeaderNav_publisher  __typename}fragment PublisherHeaderBackground_publisher on Publisher {  __typename  id  customStyleSheet {    ...PublisherHeaderBackground_customStyleSheet    __typename    id  }  ... on Collection {    colorPalette {      tintBackgroundSpectrum {        backgroundColor        __typename      }      __typename    }    isAuroraVisible    legacyHeaderBackgroundImage 
    {      id      originalWidth      focusPercentX      focusPercentY      __typename    }    ...collectionTintBackgroundTheme_collection    __typename    id  }  ...publisherUrl_publisher}fragment PublisherHeaderBackground_customStyleSheet on CustomStyleSheet {  id  global {    colorPalette {      background {        rgb        __typename      }      __typename    }    __typename  }  header {    headerScale    backgroundImageDisplayMode    backgroundImageVerticalAlignment    backgroundColorDisplayMode    backgroundColor {      alpha      rgb      ...getHexFromColorValue_colorValue      ...getOpaqueHexFromColorValue_colorValue      __typename    }    secondaryBackgroundColor {      ...getHexFromColorValue_colorValue      __typename    }    postBackgroundColor {      ...getHexFromColorValue_colorValue      __typename    }    
    backgroundImage {      ...MetaHeaderBackground_imageMetadata      __typename    }    __typename  }  __typename}fragment getHexFromColorValue_colorValue on ColorValue {  rgb  alpha  __typename}fragment getOpaqueHexFromColorValue_colorValue on ColorValue {  rgb  __typename}fragment MetaHeaderBackground_imageMetadata on ImageMetadata {  id  originalWidth  __typename}fragment collectionTintBackgroundTheme_collection on Collection {  colorPalette {    ...collectionTintBackgroundTheme_colorPalette    __typename  }  customStyleSheet {    id    ...collectionTintBackgroundTheme_customStyleSheet    __typename  }  __typename  id}fragment collectionTintBackgroundTheme_colorPalette on ColorPalette {  ...customTintBackgroundTheme_colorPalette  __typename}fragment customTintBackgroundTheme_colorPalette on ColorPalette {  tintBackgroundSpectrum {    ...ThemeUtil_colorSpectrum    __typename  }  __typename}fragment ThemeUtil_colorSpectrum on ColorSpectrum 
    {  backgroundColor  ...ThemeUtilInterpolateHelpers_colorSpectrum  __typename}fragment ThemeUtilInterpolateHelpers_colorSpectrum on ColorSpectrum {  colorPoints {    ...ThemeUtil_colorPoint    __typename  }  __typename}fragment ThemeUtil_colorPoint on ColorPoint {  color  point  __typename}fragment collectionTintBackgroundTheme_customStyleSheet on CustomStyleSheet {  id  ...customTintBackgroundTheme_customStyleSheet  __typename}fragment customTintBackgroundTheme_customStyleSheet on CustomStyleSheet {  id  global {    colorPalette {      primary {        colorPalette {          ...customTintBackgroundTheme_colorPalette          __typename        }        __typename      }      __typename    }    __typename  }  __typename}fragment publisherUrl_publisher on Publisher {  id  __typename  ... on Collection {    ...collectionUrl_collection    __typename    id  }  ... on User {    ...userUrl_user    __typename    id  }}fragment collectionUrl_collection on Collection 
    {  id  domain  slug  __typename}fragment userUrl_user on User {  __typename  id  customDomainState {    live {      domain      __typename    }    __typename  }  hasSubdomain  username}fragment PublisherHeaderNameplate_publisher on Publisher {  ...PublisherAvatar_publisher  ...PublisherHeaderLogo_publisher  ...PublisherFollowersCount_publisher  __typename}fragment PublisherAvatar_publisher on Publisher {  __typename  ... on Collection {    id    ...CollectionAvatar_collection    __typename  }  ... on User {    id    ...UserAvatar_user    __typename  }}fragment CollectionAvatar_collection on Collection {  name  avatar {    id    __typename  }  ...collectionUrl_collection  __typename  id}fragment UserAvatar_user on User {  __typename  id  imageId  mediumMemberAt  name  username  ...userUrl_user}fragment PublisherHeaderLogo_publisher on Publisher {  __typename  id  customStyleSheet {    id    header {      logoImage {        id        originalHeight        originalWidth        __typename      }     
    appNameColor {        ...getHexFromColorValue_colorValue        __typename      }      appNameTreatment      __typename    }    __typename  }  name  ... on Collection {    isAuroraVisible    logo {      id      originalHeight      originalWidth      __typename    }    __typename    id  }  ...CustomHeaderTooltip_publisher  ...publisherUrl_publisher}fragment CustomHeaderTooltip_publisher on Publisher {  __typename  id  customStyleSheet {    id    header {      appNameTreatment      nameTreatment      __typename    }    __typename  }  ... on Collection {    isAuroraVisible    slug    __typename    id  }}fragment PublisherFollowersCount_publisher on Publisher {  id  __typename  id  ... on Collection {    slug    subscriberCount    __typename    id  }  ... on User {    socialStats {      followerCount      __typename    }    username    ...userUrl_user    __typename    id  }}fragment PublisherHeaderActions_publisher on Publisher {  __typename  ...MetaHeaderPubMenu_publisher  ... on Collection {    ...CollectionFollowButton_collection    __typename    id  }  ... on User {    ...FollowAndSubscribeButtons_user    __typename    id  }}fragment MetaHeaderPubMenu_publisher on Publisher {  __typename  ... on Collection {    ...MetaHeaderPubMenu_publisher_collection    __typename    id  }  ... on User {    ...MetaHeaderPubMenu_publisher_user    __typename    id  }}fragment MetaHeaderPubMenu_publisher_collection on Collection {  id  slug  name  domain  newsletterV3 {    slug    __typename    id  }  ...MutePopoverOptions_collection  __typename}fragment MutePopoverOptions_collection on Collection 
    {  id  __typename}fragment MetaHeaderPubMenu_publisher_user on User {  id  username  ...MutePopoverOptions_creator  __typename}fragment MutePopoverOptions_creator on User {  id  __typename}fragment CollectionFollowButton_collection on Collection {  __typename  id  name  slug  ...collectionUrl_collection  ...SusiClickable_collection}fragment SusiClickable_collection on Collection {  ...SusiContainer_collection  __typename  id}fragment SusiContainer_collection on Collection {  name  ...SignInOptions_collection  ...SignUpOptions_collection  __typename  id}fragment SignInOptions_collection on Collection {  id  name  __typename}fragment SignUpOptions_collection on Collection {  id  name  __typename}fragment FollowAndSubscribeButtons_user on User {  ...UserFollowButton_user  ...UserSubscribeButton_user  __typename  id}fragment UserFollowButton_user on User {  ...UserFollowButtonSignedIn_user  ...UserFollowButtonSignedOut_user  __typename  id}fragment UserFollowButtonSignedIn_user on User {  id  name  __typename}fragment UserFollowButtonSignedOut_user on User {  id  ...SusiClickable_user  __typename}fragment SusiClickable_user on User {  ...SusiContainer_user  __typename  id}fragment SusiContainer_user on User {  ...SignInOptions_user  ...SignUpOptions_user  __typename  id}fragment SignInOptions_user on User {  id  name  __typename}fragment SignUpOptions_user on User {  id  name  __typename}fragment UserSubscribeButton_user on User {  id  isPartnerProgramEnrolled  name  viewerEdge {    id    isFollowing    isUser    __typename  }  viewerIsUser  newsletterV3 {    id    ...useNewsletterV3Subscription_newsletterV3    __typename  }  
    ...useNewsletterV3Subscription_user  ...MembershipUpsellModal_user  __typename}fragment useNewsletterV3Subscription_newsletterV3 on NewsletterV3 {  id  type  slug  name  collection {    slug    __typename    id  }  user {    id    name    username    newsletterV3 {      id      __typename    }    __typename  }  __typename}fragment useNewsletterV3Subscription_user on User {  id  username  newsletterV3 {    ...useNewsletterV3Subscription_newsletterV3    __typename    id  }  __typename}fragment MembershipUpsellModal_user on User {  id  name  imageId  postSubscribeMembershipUpsellShownAt  newsletterV3 {    id    __typename  }  __typename}fragment PublisherHeaderNav_publisher on Publisher {  __typename  id  customStyleSheet {    navigation {      navItems {        name        ...PublisherHeaderNavLink_headerNavigationItem        __typename      }      __typename    }    __typename    id  }  ...PublisherHeaderNavLink_publisher  ... on Collection {    domain    isAuroraVisible    slug    navItems {      tagSlug      title      url      __typename    }    __typename    id  }  ... on User {    customDomainState {      live {        domain        __typename      }      __typename    }    hasSubdomain    username    about    homePostsPublished: homepagePostsConnection(paging: {limit: 1}) {      posts {        id        __typename      }      __typename    }    __typename    id  }}fragment PublisherHeaderNavLink_headerNavigationItem on HeaderNavigationItem {  href  name  tags {    id    normalizedTagSlug    __typename  }  type  __typename}fragment PublisherHeaderNavLink_publisher on Publisher {  __typename  id  ... on Collection {    slug    __typename    id  }}fragment PublisherHomepagePosts_publisher on Publisher {  __typename  id  homepagePostsConnection(    paging: {limit: $homepagePostsLimit, from: $homepagePostsFrom}    includeDistributedResponses: $includeDistributedResponses  ) 
    {    posts {      ...PostPreview_post      __typename    }    pagingInfo {      next {        from        limit        __typename      }      __typename    }    __typename  }  ...CardByline_publisher  ...NewsletterV3Promo_publisher  ...PublisherHomepagePosts_user}fragment PostPreview_post on Post {  id  creator {    ...PostPreview_user    __typename    id  }  collection {    ...CardByline_collection    __typename    id  }  ...InteractivePostBody_postPreview  firstPublishedAt  isLocked  isSeries  isShortform  latestPublishedAt  inResponseToCatalogResult {    __typename  }  previewImage {    id    focusPercentX    focusPercentY    __typename  }  readingTime  sequence {    slug    __typename  }  title  uniqueSlug  visibility  ...CardByline_post  ...PostFooterActionsBar_post  ...InResponseToEntityPreview_post  ...PostScrollTracker_post  ...ReadMore_post  ...HighDensityPreview_post  __typename}fragment PostPreview_user on User {  __typename  name  username  ...CardByline_user  id}fragment CardByline_user on User {  __typename  id  name  username  mediumMemberAt  socialStats {    followerCount    __typename  }  ...userUrl_user  ...UserMentionTooltip_user}fragment UserMentionTooltip_user on User {  id  name  username  bio  imageId  mediumMemberAt  ...UserAvatar_user  ...UserFollowButton_user  __typename}fragment CardByline_collection on Collection {  __typename  id  name  ...collectionUrl_collection}fragment InteractivePostBody_postPreview on Post {  extendedPreviewContent(    truncationConfig: {previewParagraphsWordCountThreshold: 400, minimumWordLengthForTruncation: 150, truncateAtEndOfSentence: true, showFullImageCaptions: true, shortformPreviewParagraphsWordCountThreshold: 30, shortformMinimumWordLengthForTruncation: 30}  ) {    bodyModel {      ...PostBody_bodyModel      __typename    }    isFullContent    __typename  }  __typename  id}fragment PostBody_bodyModel on RichText {  sections {    name    startIndex    textLayout    imageLayout    backgroundImage {      id      originalHeight      originalWidth      __typename    }    
    videoLayout    backgroundVideo {      videoId      originalHeight      originalWidth      previewImageId      __typename    }    __typename  }  paragraphs {    id    ...PostBodySection_paragraph    __typename  }  ...normalizedBodyModel_richText  __typename}fragment PostBodySection_paragraph on Paragraph {  name  ...PostBodyParagraph_paragraph  __typename  id}fragment PostBodyParagraph_paragraph on Paragraph {  name  type  ...ImageParagraph_paragraph  ...TextParagraph_paragraph  ...IframeParagraph_paragraph  ...MixtapeParagraph_paragraph  ...CodeBlockParagraph_paragraph  __typename  id}fragment ImageParagraph_paragraph on Paragraph {  href  layout  metadata {    id    originalHeight    originalWidth    focusPercentX    focusPercentY    alt    __typename  }  ...Markups_paragraph  ...ParagraphRefsMapContext_paragraph  ...PostAnnotationsMarker_paragraph  __typename  id}fragment Markups_paragraph on Paragraph {  name  text  hasDropCap  dropCapImage {    ...MarkupNode_data_dropCapImage    __typename    id  }  markups {    type    start    end    href    anchorType    userId    linkMetadata {      httpStatus      __typename    }    __typename  }  __typename  id}fragment MarkupNode_data_dropCapImage on ImageMetadata {  ...DropCap_image  __typename  id}fragment DropCap_image on ImageMetadata {  id  originalHeight  originalWidth  __typename}fragment ParagraphRefsMapContext_paragraph on Paragraph {  id  name  text  __typename}fragment PostAnnotationsMarker_paragraph on Paragraph {  ...PostViewNoteCard_paragraph  __typename  id}fragment PostViewNoteCard_paragraph on Paragraph {  name  __typename  id}fragment TextParagraph_paragraph on Paragraph {  type  hasDropCap  codeBlockMetadata {    mode    lang    __typename  }  ...Markups_paragraph  ...ParagraphRefsMapContext_paragraph  __typename  id}fragment IframeParagraph_paragraph on Paragraph {  iframe {    mediaResource {      id      iframeSrc      iframeHeight      iframeWidth      title      __typename    }    __typename  }  layout  ...getEmbedlyCardUrlParams_paragraph  ...Markups_paragraph  __typename  id}fragment getEmbedlyCardUrlParams_paragraph on Paragraph 
    {  type  iframe {    mediaResource {      iframeSrc      __typename    }    __typename  }  __typename  id}fragment MixtapeParagraph_paragraph on Paragraph {  type  mixtapeMetadata {    href    mediaResource {      mediumCatalog {        id        __typename      }      __typename    }    __typename  }  ...GenericMixtapeParagraph_paragraph  __typename  id}fragment GenericMixtapeParagraph_paragraph on Paragraph {  text  mixtapeMetadata {    href    thumbnailImageId    __typename  }  markups {    start    end    type    href    __typename  }  __typename  id}fragment CodeBlockParagraph_paragraph on Paragraph {  codeBlockMetadata {    lang    mode    __typename  }  __typename  id}fragment normalizedBodyModel_richText on RichText {  paragraphs {    markups {      type      __typename    }    codeBlockMetadata {      lang      mode      __typename    }    ...getParagraphHighlights_paragraph    ...getParagraphPrivateNotes_paragraph    __typename  }  sections {    startIndex    ...getSectionEndIndex_section    __typename  }  ...getParagraphStyles_richText  ...getParagraphSpaces_richText  __typename}fragment getParagraphHighlights_paragraph on Paragraph {  name  __typename  id}fragment getParagraphPrivateNotes_paragraph on Paragraph {  name  __typename  id}fragment getSectionEndIndex_section on Section {  startIndex  __typename}fragment getParagraphStyles_richText on RichText {  paragraphs {    text    type    __typename  }  sections {    ...getSectionEndIndex_section    __typename  }  __typename}fragment getParagraphSpaces_richText on RichText {  paragraphs {    layout    metadata {      originalHeight      originalWidth      id      __typename    }    type    ...paragraphExtendsImageGrid_paragraph    __typename  }  ...getSeriesParagraphTopSpacings_richText  ...getPostParagraphTopSpacings_richText  __typename}fragment paragraphExtendsImageGrid_paragraph on Paragraph {  layout  type  __typename  id}fragment getSeriesParagraphTopSpacings_richText on RichText {  paragraphs {    id    __typename  }  sections {    startIndex    __typename  }  __typename}fragment getPostParagraphTopSpacings_richText on RichText 
    {  paragraphs {    layout    text    codeBlockMetadata {      lang      mode      __typename    }    __typename  }  sections {    startIndex    __typename  }  __typename}fragment CardByline_post on Post {  ...DraftStatus_post  ...Star_post  ...shouldShowPublishedInStatus_post  __typename  id}fragment DraftStatus_post on Post {  id  pendingCollection {    id    creator {      id      __typename    }    ...BoldCollectionName_collection    __typename  }  statusForCollection  creator {    id    __typename  }  isPublished  __typename}fragment BoldCollectionName_collection on Collection {  id  name  __typename}fragment Star_post on Post {  id  creator {    id    __typename  }  __typename}fragment shouldShowPublishedInStatus_post on Post {  statusForCollection  isPublished  __typename  id}fragment PostFooterActionsBar_post on Post {  id  visibility  isPublished  allowResponses  postResponses {    count    __typename  }  isLimitedState  creator {    id    __typename  }  collection {    id    __typename  }  ...BookmarkButton_post  ...MultiVote_post  ...SharePostButtons_post  ...PostFooterSocialPopover_post  ...OverflowMenuButtonWithNegativeSignal_post  __typename}fragment BookmarkButton_post on Post {  visibility  ...SusiClickable_post  ...AddToCatalogBookmarkButton_post  __typename  id}fragment SusiClickable_post on Post {  id  mediumUrl  ...SusiContainer_post  __typename}fragment SusiContainer_post on Post {  id  __typename}fragment AddToCatalogBookmarkButton_post on Post {  ...AddToCatalogBase_post  __typename  id}fragment AddToCatalogBase_post on Post {  id  __typename}fragment MultiVote_post on Post {  id  creator {    id    ...SusiClickable_user    __typename  }  isPublished  ...SusiClickable_post  collection {    id    slug    __typename  }  isLimitedState  ...MultiVoteCount_post  __typename}fragment MultiVoteCount_post on Post {  id  ...PostVotersNetwork_post  __typename}fragment PostVotersNetwork_post on Post {  id  voterCount  recommenders {    name    __typename  }  __typename}fragment SharePostButtons_post on Post {  id  isLimitedState  visibility  mediumUrl  ...SharePostButton_post  ...usePostUrl_post  __typename}fragment SharePostButton_post on Post 
    {  id  __typename}fragment usePostUrl_post on Post {  id  creator {    ...userUrl_user    __typename    id  }  collection {    id    domain    slug    __typename  }  isSeries  mediumUrl  sequence {    slug    __typename  }  uniqueSlug  __typename}fragment PostFooterSocialPopover_post on Post {  id  mediumUrl  title  ...SharePostButton_post  ...usePostUrl_post  __typename}fragment OverflowMenuButtonWithNegativeSignal_post on Post {  id  ...OverflowMenuWithNegativeSignal_post  ...CreatorActionOverflowPopover_post  __typename}fragment OverflowMenuWithNegativeSignal_post on Post {  id  creator {    id    __typename  }  collection {    id    __typename  }  ...OverflowMenuItemUndoClaps_post  __typename}fragment OverflowMenuItemUndoClaps_post on Post {  id  clapCount  ...ClapMutation_post  __typename}fragment ClapMutation_post on Post {  __typename  id  clapCount  ...MultiVoteCount_post}fragment CreatorActionOverflowPopover_post on Post {  allowResponses  id  statusForCollection  isLocked  isPublished  clapCount  mediumUrl  pinnedAt  pinnedByCreatorAt  curationEligibleAt  mediumUrl  responseDistribution  visibility  inResponseToPostResult {    __typename  }  inResponseToCatalogResult {    __typename  }  pendingCollection {    id    name    creator {      id      __typename    }    avatar {      id      __typename    }    domain    slug    __typename  }  creator {    id    ...MutePopoverOptions_creator    ...auroraHooks_publisher    __typename  }  collection {    id    name    creator {      id      __typename    }    avatar {      id      __typename    }    domain    slug    ...MutePopoverOptions_collection    ...auroraHooks_publisher    __typename  }  ...useIsPinnedInContext_post  ...NewsletterV3EmailToSubscribersMenuItem_post  ...OverflowMenuItemUndoClaps_post  __typename}fragment auroraHooks_publisher on Publisher {  __typename  ... on Collection {    isAuroraEligible    isAuroraVisible    viewerEdge {      id      isEditor      __typename    }    __typename    id  }  ... on User {    isAuroraVisible    __typename    id  }}fragment useIsPinnedInContext_post on Post {  id  collection {    id    __typename  }  pendingCollection {    id    __typename  }  pinnedAt  pinnedByCreatorAt  __typename}fragment NewsletterV3EmailToSubscribersMenuItem_post on Post {  id  creator {    id    newsletterV3 {      id      subscribersCount      __typename    }    __typename  }  
    isNewsletter  isAuthorNewsletter  __typename}fragment InResponseToEntityPreview_post on Post {  id  inResponseToEntityType  __typename}fragment PostScrollTracker_post on Post {  id  collection {    id    __typename  }  sequence {    sequenceId    __typename  }  __typename}fragment ReadMore_post on Post {  mediumUrl  readingTime  ...usePostUrl_post  __typename  id}fragment HighDensityPreview_post on Post {  id  title  previewImage {    id    focusPercentX    focusPercentY    __typename  }  extendedPreviewContent(    truncationConfig: {previewParagraphsWordCountThreshold: 400, minimumWordLengthForTruncation: 150, truncateAtEndOfSentence: true, showFullImageCaptions: true, shortformPreviewParagraphsWordCountThreshold: 30, shortformMinimumWordLengthForTruncation: 30}  ) {    subtitle    __typename  }  ...HighDensityFooter_post  __typename}fragment HighDensityFooter_post on Post {  id  readingTime  tags {    ...TopicPill_tag    __typename  }  ...BookmarkButton_post  ...ExpandablePostCardOverflowButton_post  ...OverflowMenuButtonWithNegativeSignal_post  __typename}fragment TopicPill_tag on Tag {  __typename  id  displayTitle  normalizedTagSlug}fragment ExpandablePostCardOverflowButton_post on Post {  creator {    id    __typename  }  ...ExpandablePostCardEditorWriterButton_post  ...ExpandablePostCardReaderButton_post  __typename  id}fragment ExpandablePostCardEditorWriterButton_post on Post {  id  collection {    id    name    slug    __typename  }  allowResponses  clapCount  visibility  mediumUrl  responseDistribution  ...useIsPinnedInContext_post  ...CopyFriendLinkMenuItem_post  ...NewsletterV3EmailToSubscribersMenuItem_post  ...OverflowMenuItemUndoClaps_post  __typename}fragment CopyFriendLinkMenuItem_post on Post {  id  __typename}fragment ExpandablePostCardReaderButton_post on Post {  id  collection {    id    __typename  }  creator {    id    __typename  }  clapCount  ...ClapMutation_post  __typename}fragment CardByline_publisher on Publisher {  __typename  ... on User {    id    ...CardByline_user    __typename  }  ... on Collection {    id    ...CardByline_collection    __typename  }}fragment NewsletterV3Promo_publisher on Publisher {  __typename  ... on User {    ...NewsletterV3Promo_publisher_User    __typename    id  }  ... on Collection {    ...NewsletterV3Promo_publisher_Collection    __typename    id  }}fragment NewsletterV3Promo_publisher_User on User 
    {  id  username  name  viewerEdge {    isUser    __typename    id  }  newsletterV3 {    id    ...NewsletterV3Promo_newsletterV3    __typename  }  __typename}fragment NewsletterV3Promo_newsletterV3 on NewsletterV3 {  slug  name  description  promoHeadline  promoBody  ...NewsletterV3SubscribeButton_newsletterV3  ...NewsletterV3SubscribeByEmail_newsletterV3  __typename  id}fragment NewsletterV3SubscribeButton_newsletterV3 on NewsletterV3 {  id  name  slug  type  user {    id    name    username    __typename  }  collection {    slug    ...SusiClickable_collection    ...collectionDefaultBackgroundTheme_collection    __typename    id  }  ...SusiClickable_newsletterV3  ...useNewsletterV3Subscription_newsletterV3  __typename}fragment collectionDefaultBackgroundTheme_collection on Collection {  colorPalette {    ...collectionDefaultBackgroundTheme_colorPalette    __typename  }  customStyleSheet {    id    ...collectionDefaultBackgroundTheme_customStyleSheet    __typename  }  __typename  id}fragment collectionDefaultBackgroundTheme_colorPalette on ColorPalette {  ...customDefaultBackgroundTheme_colorPalette  __typename}fragment customDefaultBackgroundTheme_colorPalette on ColorPalette {  highlightSpectrum {    ...ThemeUtil_colorSpectrum    __typename  }  defaultBackgroundSpectrum {    ...ThemeUtil_colorSpectrum    __typename  }  tintBackgroundSpectrum {    ...ThemeUtil_colorSpectrum    __typename  }  __typename}fragment collectionDefaultBackgroundTheme_customStyleSheet on CustomStyleSheet {  id  ...customDefaultBackgroundTheme_customStyleSheet  __typename}fragment customDefaultBackgroundTheme_customStyleSheet on CustomStyleSheet {  id  global {    colorPalette {      primary {        colorPalette {          ...customDefaultBackgroundTheme_colorPalette          __typename        }        __typename      }      background {        colorPalette {          ...customDefaultBackgroundTheme_colorPalette          __typename        }        __typename      }      __typename    }    __typename  }  __typename}fragment SusiClickable_newsletterV3 on NewsletterV3 {  ...SusiContainer_newsletterV3  __typename  id}fragment SusiContainer_newsletterV3 on NewsletterV3 {  ...SignInOptions_newsletterV3  ...SignUpOptions_newsletterV3  __typename  id}fragment SignInOptions_newsletterV3 on NewsletterV3 {  id  name  __typename}fragment SignUpOptions_newsletterV3 on NewsletterV3 {  id  name  __typename}fragment NewsletterV3SubscribeByEmail_newsletterV3 on NewsletterV3 {  id  slug  type  user {    id    name    username    __typename  }  collection {    ...collectionDefaultBackgroundTheme_collection    ...collectionUrl_collection    __typename    id  }  __typename}fragment NewsletterV3Promo_publisher_Collection on Collection {  id  slug  domain  name  newsletterV3 {    id    ...NewsletterV3Promo_newsletterV3    __typename  }  __typename}fragment PublisherHomepagePosts_user on User 
    {  id  ...useShowAuthorNewsletterV3Promo_user  __typename}fragment useShowAuthorNewsletterV3Promo_user on User {  id  username  newsletterV3 {    id    showPromo    slug    __typename  }  __typename}fragment UserSubdomainFlow_user on User {  id  hasCompletedProfile  name  bio  imageId  ...UserCompleteProfileDialog_user  ...UserSubdomainOnboardingDialog_user  __typename}fragment UserCompleteProfileDialog_user on User {  id  name  bio  imageId  hasCompletedProfile  __typename}fragment UserSubdomainOnboardingDialog_user on User {  id  customDomainState {    pending {      status      __typename    }    live {      status      __typename    }    __typename  }  username  __typename}fragment UserProfileMetadata_user on User {  id  username  name  bio  socialStats {    followerCount    followingCount    __typename  }  ...userUrl_user  ...UserProfileMetadataHelmet_user  __typename}fragment UserProfileMetadataHelmet_user on User {  username  name  imageId  twitterScreenName  navItems {    title    __typename  }  __typename  id}fragment SuspendedBannerLoader_user on User {  id  isSuspended  __typename}fragment useAnalytics_user on User {  id  imageId  name  username  __typename}fragment EntityDrivenSubscriptionLandingPageScreen_writer on User {  name  imageId  id  username  isPartnerProgramEnrolled  referredMembershipCustomHeadline  referredMembershipCustomBody  customStyleSheet {    ...CustomThemeProvider_customStyleSheet    ...CustomBackgroundWrapper_customStyleSheet    ...MetaHeader_customStyleSheet    __typename    id  }  ...MetaHeader_publisher  ...userUrl_user  __typename}fragment CustomThemeProvider_customStyleSheet on CustomStyleSheet {  id  ...customDefaultBackgroundTheme_customStyleSheet  ...customStyleSheetFontTheme_customStyleSheet  __typename}fragment customStyleSheetFontTheme_customStyleSheet on CustomStyleSheet {  id  global {    fonts {      font1 {        name        __typename      }      font2 {        name        __typename      }      font3 {        name        __typename      }      __typename    }    __typename  }  __typename}fragment CustomBackgroundWrapper_customStyleSheet on CustomStyleSheet {  id  global {    colorPalette {      background {        ...getHexFromColorValue_colorValue        __typename      }      __typename    }    __typename  }  __typename}fragment MetaHeader_customStyleSheet on CustomStyleSheet {  id  header {    headerScale    horizontalAlignment    __typename  }  ...MetaHeaderBackground_customStyleSheet  ...MetaHeaderEngagement_customStyleSheet  ...MetaHeaderLogo_customStyleSheet  ...MetaHeaderNavVertical_customStyleSheet  ...MetaHeaderTagline_customStyleSheet  ...MetaHeaderThemeProvider_customStyleSheet  __typename}fragment MetaHeaderBackground_customStyleSheet on CustomStyleSheet {  id  header {    headerScale    backgroundImageDisplayMode    backgroundImageVerticalAlignment    backgroundColorDisplayMode    backgroundColor {      ...getHexFromColorValue_colorValue      ...getOpaqueHexFromColorValue_colorValue      __typename    }    secondaryBackgroundColor {      ...getHexFromColorValue_colorValue      __typename    }    postBackgroundColor {      ...getHexFromColorValue_colorValue      __typename    }    backgroundImage {      ...MetaHeaderBackground_imageMetadata      __typename    }    __typename  }  __typename}fragment MetaHeaderEngagement_customStyleSheet on CustomStyleSheet {  ...MetaHeaderNav_customStyleSheet  __typename  id}fragment MetaHeaderNav_customStyleSheet on CustomStyleSheet {  id  navigation {    navItems {      ...MetaHeaderNav_headerNavigationItem      __typename    }    __typename  }  __typename}fragment MetaHeaderNav_headerNavigationItem on HeaderNavigationItem {  name  tagSlugs  ...MetaHeaderNavLink_headerNavigationItem  __typename}fragment MetaHeaderNavLink_headerNavigationItem on HeaderNavigationItem {  name  ...getNavItemHref_headerNavigationItem  __typename}fragment getNavItemHref_headerNavigationItem on HeaderNavigationItem {  href  type  tags {    id    normalizedTagSlug    __typename  }  __typename}fragment MetaHeaderLogo_customStyleSheet on CustomStyleSheet {  id  header {    nameColor {      ...getHexFromColorValue_colorValue      __typename    }    nameTreatment    postNameTreatment    logoImage {      ...MetaHeaderLogo_imageMetadata      __typename    }    logoScale    __typename  }  __typename}
    fragment MetaHeaderLogo_imageMetadata on ImageMetadata {  id  originalWidth  originalHeight  ...PublisherLogo_image  __typename}fragment PublisherLogo_image on ImageMetadata {  id  originalHeight  originalWidth  __typename}fragment MetaHeaderNavVertical_customStyleSheet on CustomStyleSheet {  id  navigation {    navItems {      ...MetaHeaderNavLink_headerNavigationItem      __typename    }    __typename  }  ...MetaHeaderNav_customStyleSheet  __typename}fragment MetaHeaderTagline_customStyleSheet on CustomStyleSheet {  id  header {    taglineColor {      ...getHexFromColorValue_colorValue      __typename    }    taglineTreatment    __typename  }  __typename}fragment MetaHeaderThemeProvider_customStyleSheet on CustomStyleSheet {  id  ...useMetaHeaderTheme_customStyleSheet  __typename}fragment useMetaHeaderTheme_customStyleSheet on CustomStyleSheet {  ...customDefaultBackgroundTheme_customStyleSheet  global {    colorPalette {      primary {        colorPalette {          tintBackgroundSpectrum {            ...ThemeUtil_colorSpectrum            __typename          }          __typename        }        __typename      }      __typename    }    __typename  }  header {    backgroundColor {      colorPalette {        tintBackgroundSpectrum {          ...ThemeUtil_colorSpectrum          __typename        }        __typename      }      __typename    }    postBackgroundColor {      colorPalette {        tintBackgroundSpectrum {          ...ThemeUtil_colorSpectrum          __typename        }        __typename      }      __typename    }    backgroundImage {      id      __typename    }    __typename  }  __typename  id}fragment MetaHeader_publisher on Publisher {  __typename  name  ...MetaHeaderEngagement_publisher  ...MetaHeaderLogo_publisher  ...MetaHeaderNavVertical_publisher  ...MetaHeaderTagline_publisher  ...MetaHeaderThemeProvider_publisher  ...MetaHeaderActions_publisher  ...MetaHeaderTop_publisher  ...MetaHeaderNavLink_publisher  ... on Collection 
    {    id    favicon {      id      __typename    }    tagline    ...CollectionNavigationContextProvider_collection    __typename  }  ... on User {    id    bio    ...UserProfileCatalogsLink_publisher    __typename  }}fragment MetaHeaderEngagement_publisher on Publisher {  __typename  ...MetaHeaderNav_publisher  ...PublisherAboutLink_publisher  ...PublisherFollowButton_publisher  ...PublisherFollowersCount_publisher  ... on Collection {    creator {      id      __typename    }    customStyleSheet {      id      ...CustomThemeProvider_customStyleSheet      __typename    }    __typename    id  }  ... on User {    ...UserProfileCatalogsLink_publisher    ...UserSubscribeButton_user    customStyleSheet {      id      ...CustomThemeProvider_customStyleSheet      __typename    }    __typename    id  }}fragment MetaHeaderNav_publisher on Publisher {  id  ...MetaHeaderNavLink_publisher  __typename}fragment MetaHeaderNavLink_publisher on Publisher {  id  ...getNavItemHref_publisher  __typename}fragment getNavItemHref_publisher on Publisher {  id  ...publisherUrl_publisher  __typename}fragment PublisherAboutLink_publisher on Publisher {  __typename  id  ... on Collection {    slug    __typename    id  }  ... on User {    ...userUrl_user    __typename    id  }}fragment PublisherFollowButton_publisher on Publisher {  __typename  ... on Collection {    ...CollectionFollowButton_collection    __typename    id  }  ... on User {    ...UserFollowButton_user    __typename    id  }}fragment UserProfileCatalogsLink_publisher on Publisher {  __typename  id  ... on User {    ...userUrl_user    homePostsPublished: homepagePostsConnection(paging: {limit: 1}) {      posts {        id        __typename      }      __typename    }    __typename    id  }}fragment MetaHeaderLogo_publisher on Publisher {  __typename  id  name  ... on Collection {    logo {      ...MetaHeaderLogo_imageMetadata      ...PublisherLogo_image      __typename      id    }    __typename    id  }  ...auroraHooks_publisher}fragment MetaHeaderNavVertical_publisher on Publisher {  id  ...PublisherAboutLink_publisher  ...MetaHeaderNav_publisher  ...MetaHeaderNavLink_publisher  __typename}fragment MetaHeaderTagline_publisher on Publisher {  __typename  ... on Collection {    tagline    __typename    id  }  ... on User {    bio    __typename    id  }}fragment MetaHeaderThemeProvider_publisher on Publisher {  __typename  customStyleSheet {    ...MetaHeaderThemeProvider_customStyleSheet    __typename    id  }  ... on Collection {    colorPalette {      ...customDefaultBackgroundTheme_colorPalette      __typename    }    __typename    id  }}fragment MetaHeaderActions_publisher on Publisher {  __typename  ...MetaHeaderPubMenu_publisher  ...SearchWidget_publisher  ... on Collection {    id    creator {      id      __typename    }    customStyleSheet {      navigation {        navItems {          name          __typename        }        __typename      }      __typename      id    }    ...CollectionAvatar_collection    ...CollectionMetabarActionsPopover_collection    ...MetaHeaderActions_collection_common    __typename  }  ... on User {    id    ...UserAvatar_user    __typename  }}fragment SearchWidget_publisher on Publisher {  __typename  ... on Collection {    id    slug    name    domain    __typename  }  ... on User {    id    name    __typename  }  ...algoliaSearch_publisher}fragment algoliaSearch_publisher on Publisher {  __typename  id}fragment CollectionMetabarActionsPopover_collection on Collection {  id  slug  isAuroraEligible  isAuroraVisible  newsletterV3 {    id    slug    __typename  }  ...collectionUrl_collection  __typename}fragment MetaHeaderActions_collection_common on Collection {  creator {    id    __typename  }  __typename  id}fragment MetaHeaderTop_publisher on Publisher {  __typename  ... on Collection {    slug    ...CollectionMetabarActionsPopover_collection    ...CollectionAvatar_collection    ...MetaHeaderTop_collection    __typename    id  }  ... on User {    username    id    __typename  }}fragment MetaHeaderTop_collection on Collection {  id  creator {    id    __typename  }  __typename}fragment CollectionNavigationContextProvider_collection on Collection {  id  domain  slug  isAuroraVisible  __typename}fragment useShouldShowEntityDrivenSubscription_creator on User {  id  __typename}`

    const response = await request(
        "https://medium.com/_/graphql",
        query,
        {
            homepagePostsFrom: lastId,
            homepagePostsLimit: 10,
            id: null,
            includeDistributedResponses: true,
            username: username
        },
        {
            Host: "medium.com",
            Origin: "https://medium.com",
            Referer: `https://medium.com/${username}`,
            "User-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:107.0) Gecko/20100101 Firefox/107.0",
            // Cookie: "sid=1:WIK+S3QWKDOx1ULJ6QKZPYCaO0cFPI5eMEVN5qUNQZnZZblLsZKfkNA6NcJolBuz; uid=lo_c22ece8bb218; __cfruid=70bf09aa66b6ca208e7dae928bcc36744da029d1-1670327591; dd_cookie_test_08d7bdd7-d9eb-4b9f-ab03-1dc5bc159e76=test; _dd_s=rum=0&expire=1670328494234"
        },
    )

    return response
}

const mediumQueryForCorpAcc = async (collectionId: string | null, lastId: string | null, username: string | null) => {
    const query = gql`query PublicationHomepageQuery($collectionId: ID!, $homepagePostsLimit: PaginationLimit = 25, $homepagePostsFrom: String, $includeDistributedResponses: Boolean = false) {\n  collection(id: $collectionId) {\n    __typename\n    id\n    ...PublicationHomepage_collection\n  }\n}\n\nfragment PublicationHomepage_collection on Collection {\n  id\n  ...PublisherHeader_publisher\n  ...PublisherHomepagePosts_publisher\n  ...useAnalytics_collection\n  ...CollectionMetadata_collection\n  __typename\n}\n\nfragment PublisherHeader_publisher on Publisher {\n  id\n  ...PublisherHeaderBackground_publisher\n  ...PublisherHeaderNameplate_publisher\n  ...PublisherHeaderActions_publisher\n  ...PublisherHeaderNav_publisher\n  __typename\n}\n\nfragment PublisherHeaderBackground_publisher on Publisher {\n  __typename\n  id\n  customStyleSheet {\n    ...PublisherHeaderBackground_customStyleSheet\n    __typename\n    id\n  }\n  ... on Collection {\n    colorPalette {\n      tintBackgroundSpectrum {\n        backgroundColor\n        __typename\n      }\n      __typename\n    }\n    isAuroraVisible\n    legacyHeaderBackgroundImage {\n      id\n      originalWidth\n      focusPercentX\n      focusPercentY\n      __typename\n    }\n    ...collectionTintBackgroundTheme_collection\n    __typename\n    id\n  }\n  ...publisherUrl_publisher\n}\n\nfragment PublisherHeaderBackground_customStyleSheet on CustomStyleSheet {\n  id\n  global {\n    colorPalette {\n      background {\n        rgb\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  header {\n    headerScale\n    backgroundImageDisplayMode\n    backgroundImageVerticalAlignment\n    backgroundColorDisplayMode\n    backgroundColor {\n      alpha\n      rgb\n      ...getHexFromColorValue_colorValue\n      ...getOpaqueHexFromColorValue_colorValue\n      __typename\n    }\n    secondaryBackgroundColor {\n      ...getHexFromColorValue_colorValue\n      __typename\n    }\n    postBackgroundColor {\n      ...getHexFromColorValue_colorValue\n      __typename\n    }\n    backgroundImage {\n      ...MetaHeaderBackground_imageMetadata\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment getHexFromColorValue_colorValue on ColorValue {\n  rgb\n  alpha\n  __typename\n}\n\nfragment getOpaqueHexFromColorValue_colorValue on ColorValue {\n  rgb\n  __typename\n}\n\nfragment MetaHeaderBackground_imageMetadata on ImageMetadata {\n  id\n  originalWidth\n  __typename\n}\n\nfragment collectionTintBackgroundTheme_collection on Collection {\n  colorPalette {\n    ...collectionTintBackgroundTheme_colorPalette\n    __typename\n  }\n  customStyleSheet {\n    id\n    ...collectionTintBackgroundTheme_customStyleSheet\n    __typename\n  }\n  __typename\n  id\n}\n\nfragment collectionTintBackgroundTheme_colorPalette on ColorPalette {\n  ...customTintBackgroundTheme_colorPalette\n  __typename\n}\n\nfragment customTintBackgroundTheme_colorPalette on ColorPalette {\n  tintBackgroundSpectrum {\n    ...ThemeUtil_colorSpectrum\n    __typename\n  }\n  __typename\n}\n\nfragment ThemeUtil_colorSpectrum on ColorSpectrum {\n  backgroundColor\n  ...ThemeUtilInterpolateHelpers_colorSpectrum\n  __typename\n}\n\nfragment ThemeUtilInterpolateHelpers_colorSpectrum on ColorSpectrum {\n  colorPoints {\n    ...ThemeUtil_colorPoint\n    __typename\n  }\n  __typename\n}\n\nfragment ThemeUtil_colorPoint on ColorPoint {\n  color\n  point\n  __typename\n}\n\nfragment collectionTintBackgroundTheme_customStyleSheet on CustomStyleSheet {\n  id\n  ...customTintBackgroundTheme_customStyleSheet\n  __typename\n}\n\nfragment customTintBackgroundTheme_customStyleSheet on CustomStyleSheet {\n  id\n  global {\n    colorPalette {\n      primary {\n        colorPalette {\n          ...customTintBackgroundTheme_colorPalette\n          __typename\n        }\n        __typename\n      }
    \n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment publisherUrl_publisher on Publisher {\n  id\n  __typename\n  ... on Collection {\n    ...collectionUrl_collection\n    __typename\n    id\n  }\n  ... on User {\n    ...userUrl_user\n    __typename\n    id\n  }\n}\n\nfragment collectionUrl_collection on Collection {\n  id\n  domain\n  slug\n  __typename\n}\n\nfragment userUrl_user on User {\n  __typename\n  id\n  customDomainState {\n    live {\n      domain\n      __typename\n    }\n    __typename\n  }\n  hasSubdomain\n  username\n}\n\nfragment PublisherHeaderNameplate_publisher on Publisher {\n  ...PublisherAvatar_publisher\n  ...PublisherHeaderLogo_publisher\n  ...PublisherFollowersCount_publisher\n  __typename\n}\n\nfragment PublisherAvatar_publisher on Publisher {\n  __typename\n  ... on Collection {\n    id\n    ...CollectionAvatar_collection\n    __typename\n  }\n  ... on User {\n    id\n    ...UserAvatar_user\n    __typename\n  }\n}\n\nfragment CollectionAvatar_collection on Collection {\n  name\n  avatar {\n    id\n    __typename\n  }\n  ...collectionUrl_collection\n  __typename\n  id\n}\n\nfragment UserAvatar_user on User {\n  __typename\n  id\n  imageId\n  mediumMemberAt\n  name\n  username\n  ...userUrl_user\n}\n\nfragment PublisherHeaderLogo_publisher on Publisher {\n  __typename\n  id\n  customStyleSheet {\n    id\n    header {\n      logoImage {\n        id\n        originalHeight\n        originalWidth\n        __typename\n      }\n      appNameColor {\n        ...getHexFromColorValue_colorValue\n        __typename\n      }\n      appNameTreatment\n      __typename\n    }\n    __typename\n  }\n  name\n  ... on Collection {\n    isAuroraVisible\n    logo {\n      id\n      originalHeight\n      originalWidth\n      __typename\n    }\n    __typename\n    id\n  }\n  ... on User {\n    ...useIsVerifiedBookAuthor_user\n    __typename\n    id\n  }\n  ...CustomHeaderTooltip_publisher\n  ...publisherUrl_publisher\n}\n\nfragment useIsVerifiedBookAuthor_user on User {\n  verifications {\n    isBookAuthor\n    __typename\n  }\n  __typename\n  id\n}\n\nfragment CustomHeaderTooltip_publisher on Publisher {\n  __typename\n  id\n  customStyleSheet {\n    id\n    header {\n      appNameTreatment\n      nameTreatment\n      __typename\n    }\n    __typename\n  }\n  ... on Collection {\n    isAuroraVisible\n    slug\n    __typename\n    id\n  }\n}\n\nfragment PublisherFollowersCount_publisher on Publisher {\n  id\n  __typename\n  id\n  ... on Collection {\n    slug\n    subscriberCount\n    __typename\n    id\n  }\n  ... on User {\n    socialStats {\n      followerCount\n      __typename\n    }\n    username\n    ...userUrl_user\n    __typename\n    id\n  }\n}\n\nfragment PublisherHeaderActions_publisher on Publisher {\n  __typename\n  ...MetaHeaderPubMenu_publisher\n  ... on Collection {\n    ...CollectionFollowButton_collection\n    __typename\n    id\n  }\n  ... on User {\n    ...FollowAndSubscribeButtons_user\n    __typename\n    id\n  }\n}\n\nfragment MetaHeaderPubMenu_publisher on Publisher {\n  __typename\n  ... on Collection {\n    ...MetaHeaderPubMenu_publisher_collection\n    __typename\n    id\n  }\n  ... on User {\n    ...MetaHeaderPubMenu_publisher_user\n    __typename\n    id\n  }\n}\n\nfragment MetaHeaderPubMenu_publisher_collection on Collection {\n  id\n  slug\n  name\n  domain\n  newsletterV3 {\n    slug\n    __typename\n    id\n  }\n  ...MutePopoverOptions_collection\n  __typename\n}\n\nfragment MutePopoverOptions_collection on Collection {\n  id\n  __typename\n}\n\nfragment MetaHeaderPubMenu_publisher_user on User {\n  id\n  username\n  ...MutePopoverOptions_creator\n  __typename\n}\n\nfragment MutePopoverOptions_creator on User {\n  id\n  __typename\n}\n\nfragment CollectionFollowButton_collection on Collection {\n  __typename\n  id\n  name\n  slug\n  ...collectionUrl_collection\n  ...SusiClickable_collection\n}\n\nfragment SusiClickable_collection on Collection 
    {\n  ...SusiContainer_collection\n  __typename\n  id\n}\n\nfragment SusiContainer_collection on Collection {\n  name\n  ...SignInOptions_collection\n  ...SignUpOptions_collection\n  __typename\n  id\n}
    \n\nfragment SignInOptions_collection on Collection {\n  id\n  name\n  __typename\n}\n\nfragment SignUpOptions_collection on Collection {\n  id\n  name\n  __typename\n}\n\nfragment FollowAndSubscribeButtons_user on User {\n  ...UserFollowButton_user\n  ...UserSubscribeButton_user\n  __typename\n  id\n}\n\nfragment UserFollowButton_user on User {\n  ...UserFollowButtonSignedIn_user\n  ...UserFollowButtonSignedOut_user\n  __typename\n  id\n}\n\nfragment UserFollowButtonSignedIn_user on User {\n  id\n  name\n  __typename\n}\n\nfragment UserFollowButtonSignedOut_user on User {\n  id\n  ...SusiClickable_user\n  __typename\n}\n\nfragment SusiClickable_user on User {\n  ...SusiContainer_user\n  __typename\n  id\n}\n\nfragment SusiContainer_user on User {\n  ...SignInOptions_user\n  ...SignUpOptions_user\n  __typename\n  id\n}\n\nfragment SignInOptions_user on User {\n  id\n  name\n  __typename\n}\n\nfragment SignUpOptions_user on User {\n  id\n  name\n  __typename\n}\n\nfragment UserSubscribeButton_user on User {\n  id\n  isPartnerProgramEnrolled\n  name\n  viewerEdge {\n    id\n    isFollowing\n    isUser\n    __typename\n  }\n  viewerIsUser\n  newsletterV3 {\n    id\n    ...useNewsletterV3Subscription_newsletterV3\n    __typename\n  }\n  ...useNewsletterV3Subscription_user\n  ...MembershipUpsellModal_user\n  __typename\n}\n\nfragment useNewsletterV3Subscription_newsletterV3 on NewsletterV3 {\n  id\n  type\n  slug\n  name\n  collection {\n    slug\n    __typename\n    id\n  }\n  user {\n    id\n    name\n    username\n    newsletterV3 {\n      id\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment useNewsletterV3Subscription_user on User {\n  id\n  username\n  newsletterV3 {\n    ...useNewsletterV3Subscription_newsletterV3\n    __typename\n    id\n  }\n  __typename\n}\n\nfragment MembershipUpsellModal_user on User {\n  id\n  name\n  imageId\n  postSubscribeMembershipUpsellShownAt\n  newsletterV3 {\n    id\n    __typename\n  }\n  __typename\n}\n\nfragment PublisherHeaderNav_publisher on Publisher {\n  __typename\n  id\n  customStyleSheet {\n    navigation {\n      navItems {\n        name\n        ...PublisherHeaderNavLink_headerNavigationItem\n        __typename\n      }\n      __typename\n    }\n    __typename\n    id\n  }\n  ...PublisherHeaderNavLink_publisher\n  ... on Collection {\n    domain\n    isAuroraVisible\n    slug\n    navItems {\n      tagSlug\n      title\n      url\n      __typename\n    }\n    __typename\n    id\n  }\n  ... on User {\n    customDomainState {\n      live {\n        domain\n        __typename\n      }\n      __typename\n    }\n    hasSubdomain\n    username\n    about\n    homePostsPublished: homepagePostsConnection(paging: {limit: 1}) {\n      posts {\n        id\n        __typename\n      }\n      __typename\n    }\n    ...useIsVerifiedBookAuthor_user\n    __typename\n    id\n  }\n}\n\nfragment PublisherHeaderNavLink_headerNavigationItem on HeaderNavigationItem {\n  href\n  name\n  tags {\n    id\n    normalizedTagSlug\n    __typename\n  }\n  type\n  __typename\n}\n\nfragment PublisherHeaderNavLink_publisher on Publisher {\n  __typename\n  id\n  ... on Collection {\n    slug\n    __typename\n    id\n  }\n}\n\nfragment PublisherHomepagePosts_publisher on Publisher {\n  __typename\n  id\n  homepagePostsConnection(\n    paging: {limit: $homepagePostsLimit, from: $homepagePostsFrom}\n    includeDistributedResponses: $includeDistributedResponses\n  ) {\n    posts {\n      ...PostPreview_post\n      __typename\n    }\n    pagingInfo {\n      next {\n        from\n        limit\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  ...CardByline_publisher\n  ...NewsletterV3Promo_publisher\n  ...PublisherHomepagePosts_user\n}\n\nfragment PostPreview_post on Post {\n  id\n  creator {\n    ...PostPreview_user\n    __typename\n    id\n  }\n  collection {\n    ...CardByline_collection\n    ...ExpandablePostByline_collection\n    __typename\n    id\n  }\n
      ...InteractivePostBody_postPreview\n  firstPublishedAt\n  isLocked\n  isSeries\n  isShortform\n  latestPublishedAt\n  inResponseToCatalogResult {\n    __typename\n  }\n  previewImage 
    {\n    id\n    focusPercentX\n    focusPercentY\n    __typename\n  }\n  readingTime\n  sequence {\n    slug\n    __typename\n  }\n  title\n  uniqueSlug\n  visibility\n  ...CardByline_post\n  ...PostFooterActionsBar_post\n  ...InResponseToEntityPreview_post\n  ...PostScrollTracker_post\n  ...ReadMore_post\n  ...HighDensityPreview_post\n  __typename\n}\n\nfragment PostPreview_user on User {\n  __typename\n  name\n  username\n  ...CardByline_user\n  ...ExpandablePostByline_user\n  id\n}\n\nfragment CardByline_user on User {\n  __typename\n  id\n  name\n  username\n  mediumMemberAt\n  socialStats {\n    followerCount\n    __typename\n  }\n  ...useIsVerifiedBookAuthor_user\n  ...userUrl_user\n  ...UserMentionTooltip_user\n}\n\nfragment UserMentionTooltip_user on User {\n  id\n  name\n  username\n  bio\n  imageId\n  mediumMemberAt\n  ...UserAvatar_user\n  ...UserFollowButton_user\n  __typename\n}\n\nfragment ExpandablePostByline_user on User {\n  __typename\n  id\n  name\n  username\n  imageId\n  hasSubdomain\n  customDomainState {\n    live {\n      domain\n      __typename\n    }\n    __typename\n  }\n  ...useIsVerifiedBookAuthor_user\n}\n\nfragment CardByline_collection on Collection {\n  __typename\n  id\n  name\n  ...collectionUrl_collection\n}\n\nfragment ExpandablePostByline_collection on Collection {\n  __typename\n  id\n  name\n  domain\n  slug\n}\n\nfragment InteractivePostBody_postPreview on Post {\n  extendedPreviewContent(\n    truncationConfig: {previewParagraphsWordCountThreshold: 400, minimumWordLengthForTruncation: 150, truncateAtEndOfSentence: true, showFullImageCaptions: true, shortformPreviewParagraphsWordCountThreshold: 30, shortformMinimumWordLengthForTruncation: 30}\n  ) {\n    bodyModel {\n      ...PostBody_bodyModel\n      __typename\n    }\n    isFullContent\n    __typename\n  }\n  __typename\n  id\n}\n\nfragment PostBody_bodyModel on RichText {\n  sections {\n    name\n    startIndex\n    textLayout\n    imageLayout\n    backgroundImage {\n      id\n      originalHeight\n      originalWidth\n      __typename\n    }\n    videoLayout\n    backgroundVideo {\n      videoId\n      originalHeight\n      originalWidth\n      previewImageId\n      __typename\n    }\n    __typename\n  }\n  paragraphs {\n    id\n    ...PostBodySection_paragraph\n    __typename\n  }\n  ...normalizedBodyModel_richText\n  __typename\n}\n\nfragment PostBodySection_paragraph on Paragraph {\n  name\n  ...PostBodyParagraph_paragraph\n  __typename\n  id\n}\n\nfragment PostBodyParagraph_paragraph on Paragraph {\n  name\n  type\n  ...ImageParagraph_paragraph\n  ...TextParagraph_paragraph\n  ...IframeParagraph_paragraph\n  ...MixtapeParagraph_paragraph\n  ...CodeBlockParagraph_paragraph\n  __typename\n  id\n}\n\nfragment ImageParagraph_paragraph on Paragraph {\n  href\n  layout\n  metadata {\n    id\n    originalHeight\n    originalWidth\n    focusPercentX\n    focusPercentY\n    alt\n    __typename\n  }\n  ...Markups_paragraph\n  ...ParagraphRefsMapContext_paragraph\n  ...PostAnnotationsMarker_paragraph\n  __typename\n  id\n}\n\nfragment Markups_paragraph on Paragraph {\n  name\n  text\n  hasDropCap\n  dropCapImage {\n    ...MarkupNode_data_dropCapImage\n    __typename\n    id\n  }\n  markups {\n    type\n    start\n    end\n    href\n    anchorType\n    userId\n    linkMetadata {\n      httpStatus\n      __typename\n    }\n    __typename\n  }\n  __typename\n  id\n}\n\nfragment MarkupNode_data_dropCapImage on ImageMetadata {\n  ...DropCap_image\n  __typename\n  id\n}\n\nfragment DropCap_image on ImageMetadata {\n  id\n  originalHeight\n  originalWidth\n  __typename\n}\n\nfragment ParagraphRefsMapContext_paragraph on Paragraph {\n  id\n  name\n  text\n  __typename\n}\n\nfragment PostAnnotationsMarker_paragraph on Paragraph {\n  ...PostViewNoteCard_paragraph\n  __typename\n  id\n}\n\nfragment PostViewNoteCard_paragraph on Paragraph {\n  name\n  __typename\n  id\n}\n\nfragment TextParagraph_paragraph on Paragraph {\n  type\n  hasDropCap\n  codeBlockMetadata 
        {\n    mode\n    lang\n    __typename\n  }\n  ...Markups_paragraph\n  ...ParagraphRefsMapContext_paragraph\n  __typename\n  id\n}\n\nfragment IframeParagraph_paragraph on Paragraph {\n  iframe {\n    mediaResource {\n      id\n      iframeSrc\n      iframeHeight\n      iframeWidth\n      title\n      __typename\n    }\n    __typename\n  }\n  layout\n  ...getEmbedlyCardUrlParams_paragraph\n  ...Markups_paragraph\n  __typename\n  id\n}\n\nfragment getEmbedlyCardUrlParams_paragraph on Paragraph {\n  type\n  iframe {\n    mediaResource {\n      iframeSrc\n      __typename\n    }\n    __typename\n  }\n  __typename\n  id\n}\n\nfragment MixtapeParagraph_paragraph on Paragraph {\n  type\n  mixtapeMetadata {\n    href\n    mediaResource {\n      mediumCatalog {\n        id\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  ...GenericMixtapeParagraph_paragraph\n  __typename\n  id\n}\n\nfragment GenericMixtapeParagraph_paragraph on Paragraph {\n  text\n  mixtapeMetadata {\n    href\n    thumbnailImageId\n    __typename\n  }\n  markups {\n    start\n    end\n    type\n    href\n    __typename\n  }\n  __typename\n  id\n}\n\nfragment CodeBlockParagraph_paragraph on Paragraph {\n  codeBlockMetadata {\n    lang\n    mode\n    __typename\n  }\n  __typename\n  id\n}\n\nfragment normalizedBodyModel_richText on RichText {\n  paragraphs {\n    markups {\n      type\n      __typename\n    }\n    codeBlockMetadata {\n      lang\n      mode\n      __typename\n    }\n    ...getParagraphHighlights_paragraph\n    ...getParagraphPrivateNotes_paragraph\n    __typename\n  }\n  sections {\n    startIndex\n    ...getSectionEndIndex_section\n    __typename\n  }\n  ...getParagraphStyles_richText\n  ...getParagraphSpaces_richText\n  __typename\n}\n\nfragment getParagraphHighlights_paragraph on Paragraph {\n  name\n  __typename\n  id\n}\n\nfragment getParagraphPrivateNotes_paragraph on Paragraph {\n  name\n  __typename\n  id\n}\n\nfragment getSectionEndIndex_section on Section {\n  startIndex\n  __typename\n}\n\nfragment getParagraphStyles_richText on RichText {\n  paragraphs {\n    text\n    type\n    __typename\n  }\n  sections {\n    ...getSectionEndIndex_section\n    __typename\n  }\n  __typename\n}\n\nfragment getParagraphSpaces_richText on RichText {\n  paragraphs {\n    layout\n    metadata {\n      originalHeight\n      originalWidth\n      id\n      __typename\n    }\n    type\n    ...paragraphExtendsImageGrid_paragraph\n    __typename\n  }\n  ...getSeriesParagraphTopSpacings_richText\n  ...getPostParagraphTopSpacings_richText\n  __typename\n}\n\nfragment paragraphExtendsImageGrid_paragraph on Paragraph {\n  layout\n  type\n  __typename\n  id\n}\n\nfragment getSeriesParagraphTopSpacings_richText on RichText {\n  paragraphs {\n    id\n    __typename\n  }\n  sections {\n    startIndex\n    __typename\n  }\n  __typename\n}\n\nfragment getPostParagraphTopSpacings_richText on RichText {\n  paragraphs {\n    layout\n    text\n    codeBlockMetadata {\n      lang\n      mode\n      __typename\n    }\n    __typename\n  }\n  sections {\n    startIndex\n    __typename\n  }\n  __typename\n}\n\nfragment CardByline_post on Post {\n  ...DraftStatus_post\n  ...Star_post\n  ...shouldShowPublishedInStatus_post\n  __typename\n  id\n}\n\nfragment DraftStatus_post on Post {\n  id\n  pendingCollection {\n    id\n    creator {\n      id\n      __typename\n    }\n    ...BoldCollectionName_collection\n    __typename\n  }\n  statusForCollection\n  creator {\n    id\n    __typename\n  }\n  isPublished\n  __typename\n}\n\nfragment BoldCollectionName_collection on Collection {\n  id\n  name\n  __typename\n}\n\nfragment Star_post on Post {\n  id\n  creator {\n    id\n    __typename\n  }\n  __typename\n}\n\nfragment shouldShowPublishedInStatus_post on Post {\n  statusForCollection\n  isPublished\n  __typename\n  id\n}\n\nfragment PostFooterActionsBar_post on Post {\n  id\n  visibility\n  isPublished\n  allowResponses\n  postResponses {\n    count\n    __typename\n  }\n  isLimitedState\n  creator {\n    id\n    __typename\n  }\n  collection {\n    id\n    __typename\n  }\n  ...BookmarkButton_post\n  ...MultiVote_post\n  ...SharePostButtons_post\n  ...PostFooterSocialPopover_post
    \n  ...OverflowMenuButtonWithNegativeSignal_post\n  __typename\n}\n\nfragment BookmarkButton_post on Post {\n  visibility\n  ...SusiClickable_post\n  ...AddToCatalogBookmarkButton_post\n  __typename\n  id\n}\n\nfragment SusiClickable_post on Post {\n  id\n  mediumUrl\n  ...SusiContainer_post\n  __typename\n}\n\nfragment SusiContainer_post on Post {\n  id\n  __typename\n}\n\nfragment AddToCatalogBookmarkButton_post on Post {\n  ...AddToCatalogBase_post\n  __typename\n  id\n}\n\nfragment AddToCatalogBase_post on Post {\n  id\n  __typename\n}\n\nfragment MultiVote_post on Post {\n  id\n  creator {\n    id\n    ...SusiClickable_user\n    __typename\n  }\n  isPublished\n  ...SusiClickable_post\n  collection {\n    id\n    slug\n    __typename\n  }\n  isLimitedState\n  ...MultiVoteCount_post\n  __typename\n}\n\nfragment MultiVoteCount_post on Post {\n  id\n  ...PostVotersNetwork_post\n  __typename\n}\n\nfragment PostVotersNetwork_post on Post {\n  id\n  voterCount\n  recommenders {\n    name\n    __typename\n  }\n  __typename\n}\n\nfragment SharePostButtons_post on Post {\n  id\n  isLimitedState\n  visibility\n  mediumUrl\n  ...SharePostButton_post\n  ...usePostUrl_post\n  __typename\n}\n\nfragment SharePostButton_post on Post {\n  id\n  __typename\n}\n\nfragment usePostUrl_post on Post {\n  id\n  creator {\n    ...userUrl_user\n    __typename\n    id\n  }\n  collection {\n    id\n    domain\n    slug\n    __typename\n  }\n  isSeries\n  mediumUrl\n  sequence {\n    slug\n    __typename\n  }\n  uniqueSlug\n  __typename\n}\n\nfragment PostFooterSocialPopover_post on Post {\n  id\n  mediumUrl\n  title\n  ...SharePostButton_post\n  ...usePostUrl_post\n  __typename\n}\n\nfragment OverflowMenuButtonWithNegativeSignal_post on Post {\n  id\n  ...OverflowMenuWithNegativeSignal_post\n  ...CreatorActionOverflowPopover_post\n  __typename\n}\n\nfragment OverflowMenuWithNegativeSignal_post on Post {\n  id\n  creator {\n    id\n    __typename\n  }\n  collection {\n    id\n    __typename\n  }\n  ...OverflowMenuItemUndoClaps_post\n  __typename\n}\n\nfragment OverflowMenuItemUndoClaps_post on Post {\n  id\n  clapCount\n  ...ClapMutation_post\n  __typename\n}\n\nfragment ClapMutation_post on Post {\n  __typename\n  id\n  clapCount\n  ...MultiVoteCount_post\n}\n\nfragment CreatorActionOverflowPopover_post on Post {\n  allowResponses\n  id\n  statusForCollection\n  isLocked\n  isPublished\n  clapCount\n  mediumUrl\n  pinnedAt\n  pinnedByCreatorAt\n  curationEligibleAt\n  mediumUrl\n  responseDistribution\n  visibility\n  inResponseToPostResult {\n    __typename\n  }\n  inResponseToCatalogResult {\n    __typename\n  }\n  pendingCollection {\n    id\n    name\n    creator {\n      id\n      __typename\n    }\n    avatar {\n      id\n      __typename\n    }\n    domain\n    slug\n    __typename\n  }\n  creator {\n    id\n    ...MutePopoverOptions_creator\n    ...auroraHooks_publisher\n    __typename\n  }\n  collection {\n    id\n    name\n    creator {\n      id\n      __typename\n    }\n    avatar {\n      id\n      __typename\n    }\n    domain\n    slug\n    ...MutePopoverOptions_collection\n    ...auroraHooks_publisher\n    __typename\n  }\n  ...useIsPinnedInContext_post\n  ...NewsletterV3EmailToSubscribersMenuItem_post\n  ...OverflowMenuItemUndoClaps_post\n  __typename\n}\n\nfragment auroraHooks_publisher on Publisher {\n  __typename\n  ... on Collection {\n    isAuroraEligible\n    isAuroraVisible\n    viewerEdge {\n      id\n      isEditor\n      __typename\n    }\n    __typename\n    id\n  }\n  ... on User {\n    isAuroraVisible\n    __typename\n    id\n  }\n}\n\nfragment useIsPinnedInContext_post on Post {\n  id\n  collection {\n    id\n    __typename\n  }\n  pendingCollection {\n    id\n    __typename\n  }\n  pinnedAt\n  pinnedByCreatorAt\n  __typename\n}\n\nfragment NewsletterV3EmailToSubscribersMenuItem_post on Post {\n  id\n  creator {\n    id\n    newsletterV3 {\n      id\n      subscribersCount\n      __typename\n    }\n    __typename\n  }\n  isNewsletter\n  isAuthorNewsletter\n  __typename\n}\n\nfragment InResponseToEntityPreview_post on Post 
    {\n  id\n  inResponseToEntityType\n  __typename\n}\n\nfragment PostScrollTracker_post on Post {\n  id\n  collection {\n    id\n    __typename\n  }\n  sequence {\n    sequenceId\n    __typename\n  }\n  __typename\n}\n\nfragment ReadMore_post on Post {\n  mediumUrl\n  readingTime\n  ...usePostUrl_post\n  __typename\n  id\n}\n\nfragment HighDensityPreview_post on Post {\n  id\n  title\n  previewImage {\n    id\n    focusPercentX\n    focusPercentY\n    __typename\n  }\n  extendedPreviewContent(\n    truncationConfig: {previewParagraphsWordCountThreshold: 400, minimumWordLengthForTruncation: 150, truncateAtEndOfSentence: true, showFullImageCaptions: true, shortformPreviewParagraphsWordCountThreshold: 30, shortformMinimumWordLengthForTruncation: 30}\n  ) {\n    subtitle\n    __typename\n  }\n  ...HighDensityFooter_post\n  __typename\n}\n\nfragment HighDensityFooter_post on Post {\n  id\n  readingTime\n  tags {\n    ...TopicPill_tag\n    __typename\n  }\n  ...BookmarkButton_post\n  ...ExpandablePostCardOverflowButton_post\n  ...OverflowMenuButtonWithNegativeSignal_post\n  __typename\n}\n\nfragment TopicPill_tag on Tag {\n  __typename\n  id\n  displayTitle\n  normalizedTagSlug\n}\n\nfragment ExpandablePostCardOverflowButton_post on Post {\n  creator {\n    id\n    __typename\n  }\n  ...ExpandablePostCardEditorWriterButton_post\n  ...ExpandablePostCardReaderButton_post\n  __typename\n  id\n}\n\nfragment ExpandablePostCardEditorWriterButton_post on Post {\n  id\n  collection {\n    id\n    name\n    slug\n    __typename\n  }\n  allowResponses\n  clapCount\n  visibility\n  mediumUrl\n  responseDistribution\n  ...useIsPinnedInContext_post\n  ...CopyFriendLinkMenuItem_post\n  ...NewsletterV3EmailToSubscribersMenuItem_post\n  ...OverflowMenuItemUndoClaps_post\n  __typename\n}\n\nfragment CopyFriendLinkMenuItem_post on Post {\n  id\n  __typename\n}\n\nfragment ExpandablePostCardReaderButton_post on Post {\n  id\n  collection {\n    id\n    __typename\n  }\n  creator {\n    id\n    __typename\n  }\n  clapCount\n  ...ClapMutation_post\n  __typename\n}\n\nfragment CardByline_publisher on Publisher {\n  __typename\n  ... on User {\n    id\n    ...CardByline_user\n    __typename\n  }\n  ... on Collection {\n    id\n    ...CardByline_collection\n    __typename\n  }\n}\n\nfragment NewsletterV3Promo_publisher on Publisher {\n  __typename\n  ... on User {\n    ...NewsletterV3Promo_publisher_User\n    __typename\n    id\n  }\n  ... on Collection {\n    ...NewsletterV3Promo_publisher_Collection\n    __typename\n    id\n  }\n}\n\nfragment NewsletterV3Promo_publisher_User on User 
    {\n  id\n  username\n  name\n  viewerEdge {\n    isUser\n    __typename\n    id\n  }\n  newsletterV3 {\n    id\n    ...NewsletterV3Promo_newsletterV3\n    __typename\n  }\n  __typename\n}\n\nfragment NewsletterV3Promo_newsletterV3 on NewsletterV3 {\n  slug\n  name\n  description\n  promoHeadline\n  promoBody\n  ...NewsletterV3SubscribeButton_newsletterV3\n  ...NewsletterV3SubscribeByEmail_newsletterV3\n  __typename\n  id\n}\n\nfragment NewsletterV3SubscribeButton_newsletterV3 on NewsletterV3 {\n  id\n  name\n  slug\n  type\n  user {\n    id\n    name\n    username\n    __typename\n  }\n  collection {\n    slug\n    ...SusiClickable_collection\n    ...collectionDefaultBackgroundTheme_collection\n    __typename\n    id\n  }\n  ...SusiClickable_newsletterV3\n  ...useNewsletterV3Subscription_newsletterV3\n  __typename\n}\n\nfragment collectionDefaultBackgroundTheme_collection on Collection {\n  colorPalette {\n    ...collectionDefaultBackgroundTheme_colorPalette\n    __typename\n  }\n  customStyleSheet {\n    id\n    ...collectionDefaultBackgroundTheme_customStyleSheet\n    __typename\n  }\n  __typename\n  id\n}\n\nfragment collectionDefaultBackgroundTheme_colorPalette on ColorPalette {\n  ...customDefaultBackgroundTheme_colorPalette\n  __typename\n}\n\nfragment customDefaultBackgroundTheme_colorPalette on ColorPalette {\n  highlightSpectrum {\n    ...ThemeUtil_colorSpectrum\n    __typename\n  }\n  defaultBackgroundSpectrum {\n    ...ThemeUtil_colorSpectrum\n    __typename\n  }\n  tintBackgroundSpectrum {\n    ...ThemeUtil_colorSpectrum\n    __typename\n  }\n  __typename\n}\n\nfragment collectionDefaultBackgroundTheme_customStyleSheet on CustomStyleSheet {\n  id\n  ...customDefaultBackgroundTheme_customStyleSheet\n  __typename\n}\n\nfragment customDefaultBackgroundTheme_customStyleSheet on CustomStyleSheet {\n  id\n  global {\n    colorPalette {\n      primary {\n        colorPalette {\n          ...customDefaultBackgroundTheme_colorPalette\n          __typename\n        }\n        __typename\n      }\n      background {\n        colorPalette {\n          ...customDefaultBackgroundTheme_colorPalette\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment SusiClickable_newsletterV3 on NewsletterV3 {\n  ...SusiContainer_newsletterV3\n  __typename\n  id\n}\n\nfragment SusiContainer_newsletterV3 on NewsletterV3 {\n  ...SignInOptions_newsletterV3\n  ...SignUpOptions_newsletterV3\n  __typename\n  id\n}\n\nfragment SignInOptions_newsletterV3 on NewsletterV3 {\n  id\n  name\n  __typename\n}\n\nfragment SignUpOptions_newsletterV3 on NewsletterV3 {\n  id\n  name\n  __typename\n}\n\nfragment NewsletterV3SubscribeByEmail_newsletterV3 on NewsletterV3 {\n  id\n  slug\n  type\n  user {\n    id\n    name\n    username\n    __typename\n  }\n  collection {\n    ...collectionDefaultBackgroundTheme_collection\n    ...collectionUrl_collection\n    __typename\n    id\n  }\n  __typename\n}\n\nfragment NewsletterV3Promo_publisher_Collection on Collection {\n  id\n  slug\n  domain\n  name\n  newsletterV3 {\n    id\n    ...NewsletterV3Promo_newsletterV3\n    __typename\n  }\n  __typename\n}\n\nfragment PublisherHomepagePosts_user on User {\n  id\n  ...useShowAuthorNewsletterV3Promo_user\n  __typename\n}\n\nfragment useShowAuthorNewsletterV3Promo_user on User {\n  id\n  username\n  newsletterV3 {\n    id\n    showPromo\n    slug\n    __typename\n  }\n  __typename\n}\n\nfragment useAnalytics_collection on Collection {\n  id\n  googleAnalyticsId\n  __typename\n}\n\nfragment CollectionMetadata_collection on Collection {\n  avatar {\n    id\n    focusPercentX\n    focusPercentY\n    originalHeight\n    originalWidth\n    __typename\n  }\n  creator {\n    id\n    twitterScreenName\n    ...userUrl_user\n    __typename\n  }\n  seoTitle\n  seoDescription\n  description\n  domain\n  facebookPageId\n  name\n  tags\n  twitterUsername\n  createdAt\n  ptsQualifiedAt\n  customDomainState {\n    live {\n      status\n      isSubdomain\n      __typename\n    }\n    __typename\n  }\n  ...collectionUrl_collection\n  __typename\n  id\n}\n`

    const response = await request(
        "https://medium.com/_/graphql",
        query,
        {
            collectionId: collectionId,
            homepagePostsFrom: lastId,
            homepagePostsLimit: 10,
            includeDistributedResponses: true,
            username: username,
        },
        {
            Host: "medium.com",
            Origin: "https://medium.com",
            Referer: `https://medium.com/${username}`,
            "User-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:107.0) Gecko/20100101 Firefox/107.0",
            // Cookie: "sid=1:WIK+S3QWKDOx1ULJ6QKZPYCaO0cFPI5eMEVN5qUNQZnZZblLsZKfkNA6NcJolBuz; uid=lo_c22ece8bb218; __cfruid=70bf09aa66b6ca208e7dae928bcc36744da029d1-1670327591; dd_cookie_test_08d7bdd7-d9eb-4b9f-ab03-1dc5bc159e76=test; _dd_s=rum=0&expire=1670328494234"
        },
    )
    return response
}

async function getInfoFromArticle(post: Post) {
        const response = await axios.get(post.mediumUrl)
        const htmlDataArticle = response.data.split("window.__APOLLO_STATE__ = ")
        const pageState = htmlDataArticle[1].split("</script>")
        const fullArticleInObject = JSON.parse(pageState[0])
        const JSONcontent = JSON.stringify(fullArticleInObject)
        const allAttachments: string[] = []
        
        let textFronArticle: string = ""
        for (const key in fullArticleInObject) {
            if (key.indexOf("Paragraph") >= 0) {
                const element = fullArticleInObject[key];
                textFronArticle += element.text + "\n"
            }
            if (key.indexOf("ImageMetadata") >= 0) {
                const element = fullArticleInObject[key];
                if(!element.id) continue
                const imgurl = `https://miro.medium.com/${element.id}`
                allAttachments.push(imgurl)
            }
        }
    const dbMessage = createDatabaseMessage(post, textFronArticle, JSONcontent, allAttachments)
    await messageRepository.save(dbMessage);
    const attachmentsFromdbMessage = dbMessage.attachments || []
    for (const attachment of attachmentsFromdbMessage) {
        const result = await downloadAttachmentAndSaveToS3(attachment, "medium")
        if (result !== null){
            const newAttachment = {
                ...attachment,
                s3Url: result.url
                }
            await attachmentRepository.save(newAttachment)
            
        }
    }
}

const createAuthor = (author: Author): MessageAuthorEntity => {
	const dbAuthor = new MessageAuthorEntity()

	dbAuthor.id = author.id
	dbAuthor.username = author.username
	dbAuthor.avatarUrl = `https://miro.medium.com${author.imageId}`
    dbAuthor.bio = author.bio
    ? author.bio
    : null

	return dbAuthor
}

const createDatabaseMessage = (post: Post, textFronArticle: string, JSONcontent: string, allAttachments: string[]) => {
	const dbMessage = new MessageEntity()

	dbMessage.id = post.id
	dbMessage.content = textFronArticle
    dbMessage.createdTimestamp = new Date (post.firstPublishedAt);
	dbMessage.editedTimestamp = post.latestPublishedAt !== post.firstPublishedAt
		? new Date(post.latestPublishedAt)
		: null
    dbMessage.mediumJSONcontent = JSONcontent
    dbMessage.title = post.title
    dbMessage.attachments = createAttachments(dbMessage,allAttachments)
    dbMessage.author = createAuthor(post.creator)
    dbMessage.linkToMessage = post.mediumUrl

	return dbMessage
}

const createAttachments = (dbMessage: MessageEntity, allAttachmentsUrl: string[]): 
    AttachmentEntity[] | null => {
	const attachments: (AttachmentEntity | null)[] = allAttachmentsUrl.map(urlAttachment =>
		createAttachment(urlAttachment, dbMessage),
	)
	const filteredAttachments: AttachmentEntity[] = attachments.filter(
		elem => !!elem,
	) as AttachmentEntity[]
	return filteredAttachments.length ? filteredAttachments : null
}




const createAttachment = (attachmentUrl: string, dbMessage:MessageEntity) => {
	const attachment = new AttachmentEntity()

    attachment.type = "image"
	attachment.id = uuid()
	attachment.url = attachmentUrl
	return attachment
}