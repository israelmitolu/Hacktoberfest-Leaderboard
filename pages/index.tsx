import type { NextPage } from 'next'
import Head from 'next/head'
import {auth, db, githubProvider} from "../firebase";
import {useEffect, useState} from "react";
import {Button} from "@mui/material";
import {FaGithub} from "react-icons/fa";
import {signInWithPopup, signOut, User} from "@firebase/auth";
import {collection, doc, query, setDoc} from "@firebase/firestore";
import {useCollectionData, useDocumentData} from "react-firebase-hooks/firestore";
import {useRouter} from "next/router";
import Lottie from "react-lottie-player";
import loadingAnimation from '../public/loadinganimation.json'
import {LeaderboardItem} from "../components/LeaderboardItem";
import {useAuthState} from "react-firebase-hooks/auth";
import {Octokit} from "octokit";

export type UserInfo = {
    uid: string,
    displayName: string,
    email: string,
    photoUrl?: string,
    username?: string
}

export type Item = {
    user: UserInfo,
    pullRequests : any[]
}

export type PullRequestResponse = {
    total_count: number,
    incomplete_results: boolean,
    items: any[]
}

const Home: NextPage = () => {
    const router = useRouter()
    const [user] = useAuthState(auth);
    // @ts-ignore
    const [users] = useCollectionData<UserInfo>(query(collection(db,"Users")))
    const [itemList,setItemList] = useState<Item[]>([])
    const [loading,setLoading] = useState(false)
    // @ts-ignore
    const [currentUser] = useDocumentData<UserInfo>(doc(db,"Users",auth.currentUser?.uid || "lol"))

    const addUser = (user : User)=> {
        setDoc(doc(db,"Users",user.uid),{
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoUrl: user.photoURL,
            // @ts-ignore
            username: user.reloadUserInfo?.screenName
        }).catch(error=> console.error(error))
    }

    const getPullRequests = async (users: UserInfo[])=> {
        const octokit = new Octokit({auth: process.env.access_token})
        let leaderboard: Item[] = []
        let request = "GET /search/issues?per_page=100&q=type%3Apr+label%3Ahacktoberfest-accepted"
        let pullRequests = new Map<string,any[]>()
        for(let i = 0; i<users.length; i++) {
            request += `+author%3A${users[i].username}`
            // @ts-ignore
            pullRequests.set(users[i].username,[])
        }
        let response = await octokit.request(request)
        let prResponse: PullRequestResponse = response.data
        console.log(prResponse)

        prResponse.items.forEach((pr: any,i: number)=> {
            let username: string = pr.user.login
            pullRequests.get(username)?.push(pr)
        })
        pullRequests.forEach((prs,username) => {
            console.log(username,prs)
            leaderboard.push({
                // @ts-ignore
                user: users.find((user)=> {
                    return user.username === username
                }),
                pullRequests: prs
            })
        })

        console.log(leaderboard)
        leaderboard.sort((i1,i2)=> {
            return i2.pullRequests.length - i1.pullRequests.length
        })
        return leaderboard
    }

    useEffect(()=> {
        if(!users)
            return
        setLoading(true)
        getPullRequests(users)
            .then(leaderboard => setItemList(leaderboard))
            .catch(error=> console.error(error))
            .finally(()=> setLoading(false))
    },[users])

    return (
        <div>
            <Head>
                <title>Leaderboard</title>
                <meta name="description" content="Let's do some stuff hehehehehehe" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            {
                user ? (
                    <Button
                        onClick={()=> {
                            signOut(auth)
                                .catch(error => console.error(error))
                        }}>
                        {currentUser?.username || "Sadge"}
                    </Button>
                ) : (
                    <Button
                        onClick={()=>{
                            signInWithPopup(auth,githubProvider)
                                .then(result => {
                                    addUser(result.user)
                                })
                                .catch(error=> {
                                    console.error(error)
                                    console.log("sad")
                                })
                        }}>
                        <FaGithub/>
                        <span>Sign in</span>
                    </Button>
                )
            }
            <div className="w-[100%] text-center font-bold text-[50px]">
                Leaderboard
            </div>
            {
                !loading ? (
                    <div>
                        {
                            itemList.length > 0 && itemList.map((item,i)=> {
                                return <LeaderboardItem item={item} rank={i+1} key={i} />
                            })
                        }
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-[60px] m-auto h-[60vh]">
                        <Lottie
                            animationData = {loadingAnimation}
                            play
                            loop
                            className="h-[140px]"
                        />
                        <div className="font-bold text-[28px]">
                            Loading
                        </div>
                    </div>
                )
            }
        </div>
    )
}

export default Home
